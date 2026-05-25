import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  roomIdForSpace,
  roomIdForBoard,
  parseBoardIdFromRoom,
  validateOp,
  validatePresence,
} from '@dailyways/collab-protocol';
import { verifyToken, canAccessSpace, canAccessBoard } from './auth.js';
import { roomManager } from './roomManager.js';
import { enrichPresenceFromProfile } from './presenceProfile.js';
import { isDevPrankAttacker } from './devAccess.js';

const MAX_OPS_PER_SEC = 120;
const MAX_POSITION_OPS_PER_SEC = 300;
const POSITION_FIELDS = new Set(['x', 'y']);
const PRESENCE_LEAVE_GRACE_MS = 150;

function boardIdMatchesRoom(reqBoardId, roomId) {
  if (!reqBoardId || !roomId) return true;
  if (reqBoardId === roomId) return true;
  if (roomId === roomIdForBoard(reqBoardId)) return true;
  return parseBoardIdFromRoom(roomId) === reqBoardId;
}

function presenceSyncPayload(roomId, peers) {
  return {
    peers,
    boardId: parseBoardIdFromRoom(roomId) || null,
    roomId,
  };
}

/** Outro socket do mesmo usuário ainda na sala Socket.IO (multi-tab no mesmo board). */
function userHasAnotherSocketInRoom(io, roomId, userId, exceptSocketId) {
  const adapterRoom = io.sockets.adapter.rooms.get(roomId);
  if (!adapterRoom) return false;
  for (const sid of adapterRoom) {
    if (sid === exceptSocketId) continue;
    const s = io.sockets.sockets.get(sid);
    if (s?.data?.userId === userId) return true;
  }
  return false;
}

async function rollbackPartialJoin(socket, roomId, joinedRoom) {
  if (!roomId) return;
  if (joinedRoom) {
    socket.leave(roomId);
    await roomManager.clientLeft(roomId);
  }
  socket.data.roomId = null;
  socket.data.canWrite = false;
}

function finalizeLeavePresence(io, roomId, userId, socketId) {
  const room = roomManager.rooms.get(roomId);
  if (!room) return [];
  roomManager.untrackSocket(roomId, userId, socketId);
  setTimeout(() => {
    if (userHasAnotherSocketInRoom(io, roomId, userId, socketId)) return;
    const peers = roomManager.finalizePresenceAfterGrace(roomId, userId);
    if (roomManager.rooms.has(roomId)) {
      io.in(roomId).emit(SERVER_EVENTS.PRESENCE_SYNC, presenceSyncPayload(roomId, peers));
    }
  }, PRESENCE_LEAVE_GRACE_MS);
  return roomManager.getPresenceList(room);
}

export function registerSocketHandlers(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      // #region agent log
      try {
        const fs = await import('fs');
        const path = await import('path');
        const { fileURLToPath } = await import('url');
        const logPath = path.resolve(
          fileURLToPath(import.meta.url),
          '../../../debug-64ad20.log',
        );
        fs.appendFileSync(
          logPath,
          `${JSON.stringify({
            sessionId: '64ad20',
            timestamp: Date.now(),
            hypothesisId: 'H2',
            location: 'socketHandlers.js:middleware',
            message: 'handshake auth',
            data: {
              hasToken: Boolean(token),
              tokenLen: token?.length ?? 0,
              origin: socket.handshake.headers?.origin ?? null,
            },
          })}\n`,
        );
      } catch {
        /* ignore */
      }
      // #endregion
      const user = await verifyToken(token);
      if (!user) return next(new Error('Unauthorized'));
      socket.data.userId = user.id;
      socket.data.userEmail = user.email;
      socket.data.accessToken = token;
      next();
    } catch (err) {
      next(new Error('Auth failed'));
    }
  });

  io.on('connection', (socket) => {
    socket.data.roomId = null;
    socket.data.canWrite = false;
    socket.data.opCount = 0;
    socket.data.positionOpCount = 0;
    socket.data.opWindowStart = Date.now();

    socket.on(CLIENT_EVENTS.JOIN, async (payload, ack) => {
      try {
        const spaceId = payload?.spaceId;
        const boardId = payload?.boardId;
        if (!spaceId && !boardId) {
          ack?.({ ok: false, error: 'Missing spaceId or boardId' });
          return;
        }

        let roomId;
        let access;

        if (boardId) {
          access = await canAccessBoard(
            socket.data.userId,
            boardId,
            socket.data.accessToken,
          );
          if (!access?.access) {
            ack?.({ ok: false, error: 'Access denied' });
            return;
          }
          roomId = roomIdForBoard(boardId);
          socket.data.boardId = boardId;
          socket.data.spaceId = null;
        } else {
          access = await canAccessSpace(
            socket.data.userId,
            spaceId,
            socket.data.accessToken,
          );
          if (!access?.access) {
            ack?.({ ok: false, error: 'Access denied' });
            return;
          }
          roomId = roomIdForSpace(spaceId);
          socket.data.spaceId = spaceId;
          socket.data.boardId = null;
        }

        const prevRoomId = socket.data.roomId;
        const alreadyInRoom = prevRoomId === roomId;

        if (prevRoomId && prevRoomId !== roomId) {
          socket.leave(prevRoomId);
          await roomManager.clientLeft(prevRoomId);
          roomManager.removePresence(prevRoomId, socket.data.userId, socket.id);
        }

        let room = await roomManager.getOrLoad(roomId, {
          accessToken: socket.data.accessToken,
        });
        if (boardId && !room.board) {
          roomManager.evictRoom(roomId);
          room = await roomManager.getOrLoad(roomId, {
            accessToken: socket.data.accessToken,
          });
        }
        if (boardId && !room.board) {
          // #region agent log
          try {
            const fs = await import('fs');
            const path = await import('path');
            const { fileURLToPath } = await import('url');
            const logPath = path.resolve(
              fileURLToPath(import.meta.url),
              '../../../debug-64ad20.log',
            );
            fs.appendFileSync(
              logPath,
              `${JSON.stringify({
                sessionId: '64ad20',
                timestamp: Date.now(),
                hypothesisId: 'H6',
                location: 'socketHandlers.js:JOIN',
                message: 'board not found after reload',
                data: { boardIdPrefix: boardId?.slice(0, 8) },
              })}\n`,
            );
          } catch {
            /* ignore */
          }
          // #endregion
          ack?.({ ok: false, error: 'Board not found' });
          return;
        }

        socket.data.roomId = roomId;
        socket.data.canWrite = access.canWrite;
        socket.join(roomId);
        if (!alreadyInRoom) {
          roomManager.clientJoined(roomId);
        }

        const state = roomManager.getRoomState(room);
        const stub = await enrichPresenceFromProfile(
          socket.data.userId,
          { userId: socket.data.userId },
          socket.data.userEmail,
        );
        roomManager.setPresence(roomId, socket.data.userId, stub, socket.id);
        const peers = roomManager.getPresenceList(room);
        const syncPayload = presenceSyncPayload(roomId, peers);
        ack?.({ ok: true, ...state, peers });
        socket.emit(SERVER_EVENTS.STATE, { ...state, peers });
        socket.emit(SERVER_EVENTS.PRESENCE_SYNC, syncPayload);
        socket.to(roomId).emit(SERVER_EVENTS.PRESENCE_SYNC, syncPayload);
      } catch (err) {
        console.error('[collab-server] join error', err);
        await rollbackPartialJoin(socket, socket.data.roomId, true);
        ack?.({ ok: false, error: err.message });
      }
    });

    socket.on(CLIENT_EVENTS.LEAVE, async (payload, ack) => {
      const roomId = socket.data.roomId;
      if (!roomId) {
        ack?.({ ok: true, peers: [] });
        return;
      }
      if (payload?.boardId && !boardIdMatchesRoom(payload.boardId, roomId)) {
        ack?.({ ok: true, skipped: true, peers: [] });
        return;
      }
      const peers = finalizeLeavePresence(io, roomId, socket.data.userId, socket.id);
      socket.leave(roomId);
      await roomManager.clientLeft(roomId);
      socket.data.roomId = null;
      ack?.({ ok: true, peers });
    });

    socket.on(CLIENT_EVENTS.OP, async (op, ack) => {
      const roomId = socket.data.roomId;
      if (!roomId) {
        ack?.({ ok: false, error: 'Not in room' });
        return;
      }
      if (!socket.data.canWrite) {
        socket.emit(SERVER_EVENTS.REJECTED, { opId: op?.opId, reason: 'Read-only' });
        ack?.({ ok: false, error: 'Read-only' });
        return;
      }
      const now = Date.now();
      if (now - socket.data.opWindowStart > 1000) {
        socket.data.opWindowStart = now;
        socket.data.opCount = 0;
        socket.data.positionOpCount = 0;
      }
      const isPositionOp = op?.entity === 'node' && POSITION_FIELDS.has(op?.field);
      if (isPositionOp) {
        socket.data.positionOpCount += 1;
        if (socket.data.positionOpCount > MAX_POSITION_OPS_PER_SEC) {
          socket.emit(SERVER_EVENTS.REJECTED, { opId: op?.opId, reason: 'Rate limit' });
          ack?.({ ok: false, error: 'Rate limit' });
          return;
        }
      } else {
        socket.data.opCount += 1;
        if (socket.data.opCount > MAX_OPS_PER_SEC) {
          socket.emit(SERVER_EVENTS.REJECTED, { opId: op?.opId, reason: 'Rate limit' });
          ack?.({ ok: false, error: 'Rate limit' });
          return;
        }
      }
      const err = validateOp(op);
      if (err) {
        socket.emit(SERVER_EVENTS.REJECTED, { opId: op?.opId, reason: err });
        ack?.({ ok: false, error: err });
        return;
      }
      const result = await roomManager.applyOp(roomId, op);
      if (!result.ok) {
        socket.emit(SERVER_EVENTS.REJECTED, { opId: op.opId, reason: result.reason });
        ack?.({ ok: false, error: result.reason });
        return;
      }
      const applied = {
        op,
        revision: result.revision,
        userId: socket.data.userId,
        opId: op.opId,
      };
      socket.to(roomId).emit(SERVER_EVENTS.APPLIED, applied);
      socket.emit(SERVER_EVENTS.APPLIED, applied);
      ack?.({ ok: true, revision: result.revision });
    });

    socket.on(CLIENT_EVENTS.PRESENCE, async (payload) => {
      let roomId = socket.data.roomId;
      if (!roomId && payload?.roomId) {
        const reqBoardId = payload.roomId;
        const access = await canAccessBoard(
          socket.data.userId,
          reqBoardId,
          socket.data.accessToken,
        );
        if (access?.access) {
          const targetRoom = roomIdForBoard(reqBoardId);
          const prev = socket.data.roomId;
          if (prev && prev !== targetRoom) {
            socket.leave(prev);
            roomManager.removePresence(prev, socket.data.userId, socket.id);
          }
          const presenceRoom = await roomManager.getOrLoad(targetRoom, {
            accessToken: socket.data.accessToken,
          });
          if (!presenceRoom.board) return;
          socket.data.roomId = targetRoom;
          socket.data.canWrite = access.canWrite;
          socket.join(targetRoom);
          roomManager.clientJoined(targetRoom);
          roomId = targetRoom;
          const state = roomManager.getRoomState(presenceRoom);
          socket.emit(SERVER_EVENTS.STATE, { ...state, peers: roomManager.getPresenceList(presenceRoom) });
        }
      }
      if (!roomId) {
        return;
      }
      if (payload?.roomId && !boardIdMatchesRoom(payload.roomId, roomId)) {
        return;
      }
      const err = validatePresence(payload);
      if (err) {
        return;
      }
      const full = await enrichPresenceFromProfile(
        socket.data.userId,
        { ...payload, userId: socket.data.userId },
        socket.data.userEmail,
      );
      const peers = roomManager.setPresence(roomId, socket.data.userId, full, socket.id) || [];
      io.in(roomId).emit(SERVER_EVENTS.PRESENCE_SYNC, presenceSyncPayload(roomId, peers));
    });

    /** DEV ONLY — prank no board (somente contas DEV). */
    socket.on('dev:prank', async (payload, ack) => {
      if (!(await isDevPrankAttacker(socket))) {
        ack?.({ ok: false, error: 'forbidden' });
        return;
      }
      const { boardId, targetUserId, action } = payload || {};
      if (!boardId || !targetUserId || !['freeze', 'hold', 'release', 'drag'].includes(action)) {
        ack?.({ ok: false, error: 'invalid' });
        return;
      }
      const roomId = roomIdForBoard(boardId);
      const room = roomManager.rooms.get(roomId);
      if (!room) {
        ack?.({ ok: false, error: 'room not loaded' });
        return;
      }
      const socketIds = room.presenceSockets?.get(targetUserId);
      if (!socketIds?.size) {
        ack?.({ ok: false, error: 'user not in room' });
        return;
      }
      if (action === 'hold' || action === 'release') {
        const held = action === 'hold';
        for (const sid of [...socketIds]) {
          io.sockets.sockets.get(sid)?.emit('dev:prank-hold', { held, boardId });
        }
        ack?.({ ok: true });
        return;
      }
      if (action === 'drag') {
        const { x, y } = payload || {};
        if (typeof x !== 'number' || typeof y !== 'number') {
          ack?.({ ok: false, error: 'invalid cursor' });
          return;
        }
        const cursorPayload = {
          cursor: { x, y, space: 'board' },
          onBoardSurface: true,
          cursorModal: null,
        };
        for (const sid of [...socketIds]) {
          io.sockets.sockets.get(sid)?.emit('dev:prank-cursor', { boardId, x, y });
        }
        const peers = roomManager.setPresence(roomId, targetUserId, cursorPayload) || [];
        io.in(roomId).emit(SERVER_EVENTS.PRESENCE_SYNC, presenceSyncPayload(roomId, peers));
        ack?.({ ok: true });
        return;
      }
      for (const sid of [...socketIds]) {
        const targetSock = io.sockets.sockets.get(sid);
        if (!targetSock) continue;
        targetSock.emit('dev:prank-frozen', {
          frozen: true,
          message: 'Mouse congelado (dev prank). F5 para voltar.',
        });
        const prevRoom = targetSock.data.roomId;
        if (prevRoom) {
          targetSock.leave(prevRoom);
          roomManager.untrackSocket(prevRoom, targetUserId, sid);
          finalizeLeavePresence(io, prevRoom, targetUserId, sid);
        }
        targetSock.data.roomId = null;
        targetSock.data.canWrite = false;
      }
      ack?.({ ok: true });
    });

    socket.on('disconnect', async () => {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      socket.data.roomId = null;
      finalizeLeavePresence(io, roomId, socket.data.userId, socket.id);
      await roomManager.clientLeft(roomId);
    });
  });
}
