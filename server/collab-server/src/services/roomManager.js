import { createOpIdTracker } from './opIdTracker.js';
import { noteRoomFlushContext } from './roomFlushContext.js';
import {
  applyRoomOp,
  flushRoomState,
  getRoomState as getRuntimeRoomState,
  hasPendingFlush,
  loadRoomState,
} from './shared/roomRuntime.js';

const FLUSH_MS = Number(process.env.COLLAB_FLUSH_MS || 600);
// Aumentado de 2min para 10min — boards idle recarregavam do banco ao reentrar rapidamente
const IDLE_EVICT_MS = Number(process.env.COLLAB_IDLE_EVICT_MS || 600000);
const MAX_FLUSH_ERRORS = 5;
// GC centralizado: um único setInterval varre todas as salas vazias, em vez de
// criar um setTimeout por sala fechada (evita acumular N timers em sequência).
const GC_INTERVAL_MS = 60_000;

function recordFlushError(room, roomId, err) {
  room.flushErrorCount = (room.flushErrorCount || 0) + 1;
  if (room.flushErrorCount >= MAX_FLUSH_ERRORS) {
    console.error(
      `[collab-server] CRÍTICO: flush falhou ${room.flushErrorCount}x consecutivas para room ${roomId}. Dados podem estar perdidos.`,
      err,
    );
  } else {
    console.error('[collab-server] flush error', roomId, err);
  }
}

function trackPresenceSocket(room, userId, socketId) {
  if (!userId || !socketId) return;
  if (!room.presenceSockets) room.presenceSockets = new Map();
  if (!room.presenceSockets.has(userId)) room.presenceSockets.set(userId, new Set());
  room.presenceSockets.get(userId).add(socketId);
}

/** @returns {boolean} true se era o último socket desse usuário na sala */
function untrackPresenceSocket(room, userId, socketId) {
  if (!userId || !socketId) return true;
  const set = room.presenceSockets?.get(userId);
  if (set) {
    set.delete(socketId);
    if (set.size > 0) return false;
    room.presenceSockets.delete(userId);
    return true;
  }
  const entry = room.presence.get(userId);
  if (entry?.socketId && entry.socketId !== socketId) return false;
  return true;
}

export class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.loading = new Map();
    // GC único: varre salas vazias e idle sem acumular um timer por sala fechada.
    this._gcTimer = setInterval(() => this._collectIdleRooms(), GC_INTERVAL_MS);
    if (this._gcTimer.unref) this._gcTimer.unref(); // não impéde o processo de fechar
  }

  _collectIdleRooms() {
    const now = Date.now();
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.clientCount === 0 && now - room.lastActivity > IDLE_EVICT_MS) {
        if (room.flushInFlight || hasPendingFlush(roomId, room)) continue;
        if (room.flushTimer) clearTimeout(room.flushTimer);
        this.rooms.delete(roomId);
      }
    }
  }

  evictRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (room?.flushTimer) clearTimeout(room.flushTimer);
    this.rooms.delete(roomId);
    this.loading.delete(roomId);
  }

  async getOrLoad(roomId, { accessToken } = {}) {
    if (this.rooms.has(roomId)) {
      const room = this.rooms.get(roomId);
      room.lastActivity = Date.now();
      // Runtime loader já trata rehidratação de board quando necessário.
      if (room.kind === 'board' && !room.board && accessToken) {
        const data = await loadRoomState(roomId, { accessToken });
        if (data?.board) {
          room.board = data.board;
          room.revision = data.revision ?? 0;
        }
      }
      return room;
    }
    if (this.loading.has(roomId)) {
      await this.loading.get(roomId);
      return this.rooms.get(roomId);
    }

    const promise = (async () => {
      const room = await loadRoomState(roomId, { accessToken });
      this.rooms.set(roomId, room);
      this.loading.delete(roomId);
    })();

    this.loading.set(roomId, promise);
    await promise;
    return this.rooms.get(roomId);
  }

  async flushNow(roomId, { force = false } = {}) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    if (room.flushTimer) {
      clearTimeout(room.flushTimer);
      room.flushTimer = null;
    }
    if (room.flushInFlight) {
      room.flushRequested = room.flushRequested || force || hasPendingFlush(roomId, room);
      return;
    }

    if (!force && !hasPendingFlush(roomId, room)) return;

    room.flushInFlight = true;
    try {
      // Coalesce: se novo flush for pedido durante um flush em andamento,
      // rodamos mais um ciclo ao final para não perder dirty recém-chegado.
      while (force || hasPendingFlush(roomId, room) || room.flushRequested) {
        force = false;
        room.flushRequested = false;
        await flushRoomState(roomId, room);
        room.flushErrorCount = 0;
      }
    } catch (err) {
      recordFlushError(room, roomId, err);
    } finally {
      room.flushInFlight = false;
    }
  }

  scheduleFlush(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.flushRequested = true;
    if (room.flushTimer) clearTimeout(room.flushTimer);
    room.flushTimer = setTimeout(async () => {
      room.flushTimer = null;
      await this.flushNow(roomId);
    }, FLUSH_MS);
  }

  shouldFlushBoardOpImmediately(op) {
    if (op?.entity !== 'board' || op?.field !== 'action') return false;
    const action = op.value;
    const t = action?.type;
    if ([
      'MOVE_CARD',
      'MOVE_LIST',
      'ADD_CARD',
      'DELETE_CARD',
      'ADD_LIST',
      'DELETE_LIST',
    ].includes(t)) {
      return true;
    }
    if (t === 'UPDATE_CARD') return true;
    if (t === 'UPDATE_SUBTASK' || t === 'TOGGLE_SUBTASK' || t === 'ADD_SUBTASK' || t === 'DELETE_SUBTASK') {
      return true;
    }
    return false;
  }

  async applyOp(roomId, op, { accessToken, userId } = {}) {
    const room = await this.getOrLoad(roomId, { accessToken });
    if (accessToken || userId) {
      noteRoomFlushContext(room, { accessToken, userId });
    }
    // Bug#4 fix: usa FIFO em vez de Set simples para nunca apagar deduplicação recente
    if (!room.seenOpIds) room.seenOpIds = createOpIdTracker(5000);
    const seen = room.seenOpIds;
    if (seen.has(op.opId)) {
      return { ok: true, duplicate: true, revision: room.revision };
    }
    seen.add(op.opId);

    const result = applyRoomOp(roomId, room, op, { userId });

    if (result.ok) {
      if (room.kind === 'board' && this.shouldFlushBoardOpImmediately(op)) {
        void this.flushNow(roomId);
      } else {
        this.scheduleFlush(roomId);
      }
      room.lastActivity = Date.now();
    }
    return { ...result, revision: room.revision };
  }

  setPresence(roomId, userId, payload, socketId = null) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const prev = room.presence.get(userId) || {};
    const sid = socketId || payload?.socketId || prev.socketId || null;
    if (sid) trackPresenceSocket(room, userId, sid);
    const merged = {
      ...prev,
      ...payload,
      userId,
      socketId: sid,
      updatedAt: Date.now(),
    };
    if (merged.cursor?.space === 'board') {
      delete merged.cursorScreen;
    }
    const inTaskModal = Boolean(merged.selectedCardId);
    const isDraggingOnBoard = Boolean(
      payload?.draggingCardId
      || prev?.draggingCardId
      || payload?.draggingListId
      || prev?.draggingListId,
    );
    const payloadHasCursor = payload?.cursor
      && typeof payload.cursor.x === 'number'
      && typeof payload.cursor.y === 'number';
    const payloadHasCursorScreen = payload?.cursorScreen
      && typeof payload.cursorScreen.x === 'number';
    if (payload?.onBoardSurface === false && !inTaskModal && !isDraggingOnBoard) {
      if (!payloadHasCursor) delete merged.cursor;
      if (!payloadHasCursorScreen) delete merged.cursorScreen;
    } else {
      const hasCursor = payload?.cursor
        && typeof payload.cursor.x === 'number'
        && typeof payload.cursor.y === 'number';
      if (!hasCursor) {
        if (prev.cursor) merged.cursor = prev.cursor;
        else delete merged.cursor;
      }
    }
    {
      const hasCursorScreen = payload?.cursorScreen
        && typeof payload.cursorScreen.x === 'number';
      if (!hasCursorScreen) {
        if (prev.cursorScreen) merged.cursorScreen = prev.cursorScreen;
        else if (payload?.onBoardSurface === false && (inTaskModal || isDraggingOnBoard)) {
          /* mantém cursorScreen no modal / durante arraste */
        } else {
          delete merged.cursorScreen;
        }
      }
    }
    {
      const hasCursorModal = payload?.cursorModal
        && typeof payload.cursorModal.x === 'number';
      if (payload?.cursorModal === null) {
        delete merged.cursorModal;
      } else if (hasCursorModal) {
        merged.cursorModal = payload.cursorModal;
      } else if (inTaskModal && prev.cursorModal) {
        merged.cursorModal = prev.cursorModal;
      } else {
        delete merged.cursorModal;
      }
    }
    room.presence.set(userId, merged);
    return this.getPresenceList(room);
  }

  /** Remove só o socket do tracking; mantém presença para grace period no disconnect. */
  untrackSocket(roomId, userId, socketId) {
    const room = this.rooms.get(roomId);
    if (!room || !socketId) return;
    untrackPresenceSocket(room, userId, socketId);
  }

  /** Apaga presença após grace period se não houver outro socket ativo. */
  finalizePresenceAfterGrace(roomId, userId) {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    const sockets = room.presenceSockets?.get(userId);
    if (sockets?.size > 0) return this.getPresenceList(room);
    room.presence.delete(userId);
    room.presenceSockets?.delete(userId);
    return this.getPresenceList(room);
  }

  /** Remove presença só quando não há outro socket ativo do mesmo usuário (F5 / multi-tab). */
  removePresence(roomId, userId, socketId = null) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (socketId) {
      const lastSocket = untrackPresenceSocket(room, userId, socketId);
      if (!lastSocket) return this.getPresenceList(room);
      const entry = room.presence.get(userId);
      if (entry?.socketId && entry.socketId !== socketId) {
        return this.getPresenceList(room);
      }
    }
    room.presence.delete(userId);
    room.presenceSockets?.delete(userId);
    return this.getPresenceList(room);
  }

  getPresenceList(room) {
    const now = Date.now();
    const peers = [];
    for (const [userId, p] of room.presence.entries()) {
      if (p.updatedAt != null && now - p.updatedAt > 60000) {
        room.presence.delete(userId);
        room.presenceSockets?.delete(userId);
        continue;
      }
      peers.push(p);
    }
    return peers;
  }

  clientJoined(roomId) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.clientCount += 1;
      room.lastActivity = Date.now();
    }
  }

  async clientLeft(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.clientCount = Math.max(0, room.clientCount - 1);
    if (room.clientCount === 0) {
      try {
        await this.flushNow(roomId, { force: true });
      } catch (err) {
        recordFlushError(room, roomId, err);
      }
      // Não cria setTimeout individual — o GC centralizado cuidará do evict.
    }
  }

  getRoomState(room) {
    return getRuntimeRoomState(room?.kind || 'space', room);
  }
}

export const roomManager = new RoomManager();
