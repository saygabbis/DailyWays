import {
  parseSpaceIdFromRoom,
  parseBoardIdFromRoom,
  parseRoomKind,
} from '@dailyways/collab-protocol';
import { loadRoomFromDb } from './loadRoom.js';
import { loadBoardFromDb } from './loadBoard.js';
import { applyOpToRoom } from './applyOp.js';
import { applyBoardOpToRoom } from './applyBoardOp.js';
import { flushRoom } from './persistence.js';
import { flushBoard } from './flushBoard.js';

const FLUSH_MS = Number(process.env.COLLAB_FLUSH_MS || 3000);
const IDLE_EVICT_MS = Number(process.env.COLLAB_IDLE_EVICT_MS || 120000);

function createSpaceRoom() {
  return {
    kind: 'space',
    nodes: [],
    connectors: [],
    comments: [],
    revision: 0,
    dirty: {
      nodes: new Set(),
      connectors: new Set(),
      comments: new Set(),
    },
    deleted: {
      nodes: new Set(),
      connectors: new Set(),
      comments: new Set(),
    },
    presence: new Map(),
    presenceSockets: new Map(),
    clientCount: 0,
    flushTimer: null,
    lastActivity: Date.now(),
  };
}

function createBoardRoom() {
  return {
    kind: 'board',
    board: null,
    revision: 0,
    dirty: false,
    presence: new Map(),
    presenceSockets: new Map(),
    clientCount: 0,
    flushTimer: null,
    lastActivity: Date.now(),
  };
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
  }

  async getOrLoad(roomId) {
    if (this.rooms.has(roomId)) {
      const room = this.rooms.get(roomId);
      room.lastActivity = Date.now();
      return room;
    }
    if (this.loading.has(roomId)) {
      await this.loading.get(roomId);
      return this.rooms.get(roomId);
    }

    const kind = parseRoomKind(roomId);
    const promise = (async () => {
      let room;
      if (kind === 'space') {
        const spaceId = parseSpaceIdFromRoom(roomId);
        const data = spaceId ? await loadRoomFromDb(spaceId) : {};
        room = { ...createSpaceRoom(), ...data };
      } else if (kind === 'board') {
        const boardId = parseBoardIdFromRoom(roomId);
        const data = boardId ? await loadBoardFromDb(boardId) : { board: null };
        room = { ...createBoardRoom(), board: data.board, revision: data.revision ?? 0 };
      } else {
        room = createSpaceRoom();
      }
      this.rooms.set(roomId, room);
      this.loading.delete(roomId);
    })();

    this.loading.set(roomId, promise);
    await promise;
    return this.rooms.get(roomId);
  }

  scheduleFlush(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    if (room.flushTimer) clearTimeout(room.flushTimer);
    room.flushTimer = setTimeout(async () => {
      room.flushTimer = null;
      try {
        if (room.kind === 'space') {
          const spaceId = parseSpaceIdFromRoom(roomId);
          if (spaceId) await flushRoom(room, spaceId);
        } else if (room.kind === 'board') {
          await flushBoard(room);
        }
      } catch (err) {
        console.error('[collab-server] flush error', roomId, err);
      }
    }, FLUSH_MS);
  }

  async applyOp(roomId, op) {
    const room = await this.getOrLoad(roomId);
    const seen = room.seenOpIds || (room.seenOpIds = new Set());
    if (seen.has(op.opId)) {
      return { ok: true, duplicate: true, revision: room.revision };
    }
    if (seen.size > 5000) seen.clear();
    seen.add(op.opId);

    const result =
      room.kind === 'board'
        ? applyBoardOpToRoom(room, op)
        : applyOpToRoom(room, op);

    if (result.ok) {
      this.scheduleFlush(roomId);
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
    const hasCursor = payload?.cursor
      && typeof payload.cursor.x === 'number'
      && typeof payload.cursor.y === 'number';
    if (!hasCursor) {
      if (prev.cursor) merged.cursor = prev.cursor;
      else delete merged.cursor;
    }
    const hasCursorScreen = payload?.cursorScreen
      && typeof payload.cursorScreen.x === 'number';
    if (!hasCursorScreen) {
      if (prev.cursorScreen) merged.cursorScreen = prev.cursorScreen;
      else delete merged.cursorScreen;
    }
    room.presence.set(userId, merged);
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
        if (room.kind === 'space') {
          const spaceId = parseSpaceIdFromRoom(roomId);
          if (spaceId) await flushRoom(room, spaceId);
        } else if (room.kind === 'board') {
          await flushBoard(room);
        }
      } catch (err) {
        console.error('[collab-server] flush on leave', err);
      }
      setTimeout(() => {
        const r = this.rooms.get(roomId);
        if (r && r.clientCount === 0 && Date.now() - r.lastActivity > IDLE_EVICT_MS) {
          if (r.flushTimer) clearTimeout(r.flushTimer);
          this.rooms.delete(roomId);
        }
      }, 30000);
    }
  }

  getRoomState(room) {
    if (room.kind === 'board') {
      return {
        board: room.board,
        revision: room.revision,
      };
    }
    return {
      nodes: room.nodes,
      connectors: room.connectors,
      comments: room.comments,
      revision: room.revision,
    };
  }
}

export const roomManager = new RoomManager();
