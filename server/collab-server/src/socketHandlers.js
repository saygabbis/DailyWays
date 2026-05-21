import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  roomIdForSpace,
  roomIdForBoard,
  validateOp,
  validatePresence,
} from '@dailyways/collab-protocol';
import { verifyToken, canAccessSpace, canAccessBoard } from './auth.js';
import { roomManager } from './roomManager.js';
import { enrichPresenceFromProfile } from './presenceProfile.js';

const MAX_OPS_PER_SEC = 120;

export function registerSocketHandlers(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const user = await verifyToken(token);
      if (!user) return next(new Error('Unauthorized'));
      socket.data.userId = user.id;
      socket.data.userEmail = user.email;
      next();
    } catch (err) {
      next(new Error('Auth failed'));
    }
  });

  io.on('connection', (socket) => {
    socket.data.roomId = null;
    socket.data.canWrite = false;
    socket.data.opCount = 0;
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
          access = await canAccessBoard(socket.data.userId, boardId);
          if (!access?.access) {
            ack?.({ ok: false, error: 'Access denied' });
            return;
          }
          roomId = roomIdForBoard(boardId);
          socket.data.boardId = boardId;
          socket.data.spaceId = null;
        } else {
          access = await canAccessSpace(socket.data.userId, spaceId);
          if (!access?.access) {
            ack?.({ ok: false, error: 'Access denied' });
            return;
          }
          roomId = roomIdForSpace(spaceId);
          socket.data.spaceId = spaceId;
          socket.data.boardId = null;
        }

        if (socket.data.roomId) {
          socket.leave(socket.data.roomId);
          await roomManager.clientLeft(socket.data.roomId);
          roomManager.removePresence(socket.data.roomId, socket.data.userId);
        }

        socket.data.roomId = roomId;
        socket.data.canWrite = access.canWrite;
        socket.join(roomId);
        roomManager.clientJoined(roomId);
        const room = await roomManager.getOrLoad(roomId);
        if (boardId && !room.board) {
          ack?.({ ok: false, error: 'Board not found' });
          return;
        }
        const state = roomManager.getRoomState(room);
        const peers = roomManager.getPresenceList(room);
        ack?.({ ok: true, ...state, peers });
        socket.emit(SERVER_EVENTS.STATE, { ...state, peers });
        socket.to(roomId).emit(SERVER_EVENTS.PRESENCE_SYNC, { peers });
      } catch (err) {
        console.error('[collab-server] join error', err);
        ack?.({ ok: false, error: err.message });
      }
    });

    socket.on(CLIENT_EVENTS.LEAVE, async () => {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      socket.leave(roomId);
      roomManager.removePresence(roomId, socket.data.userId);
      const peers = roomManager.rooms.get(roomId)
        ? roomManager.getPresenceList(roomManager.rooms.get(roomId))
        : [];
      socket.to(roomId).emit(SERVER_EVENTS.PRESENCE_SYNC, { peers });
      await roomManager.clientLeft(roomId);
      socket.data.roomId = null;
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
      }
      socket.data.opCount += 1;
      if (socket.data.opCount > MAX_OPS_PER_SEC) {
        socket.emit(SERVER_EVENTS.REJECTED, { opId: op?.opId, reason: 'Rate limit' });
        ack?.({ ok: false, error: 'Rate limit' });
        return;
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
      const roomId = socket.data.roomId;
      if (!roomId) return;
      const err = validatePresence(payload);
      if (err) return;
      const full = await enrichPresenceFromProfile(
        socket.data.userId,
        { ...payload, userId: socket.data.userId },
        socket.data.userEmail,
      );
      const peers = roomManager.setPresence(roomId, socket.data.userId, full);
      socket.to(roomId).emit(SERVER_EVENTS.PRESENCE_SYNC, { peers });
    });

    socket.on('disconnect', async () => {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      roomManager.removePresence(roomId, socket.data.userId);
      const room = roomManager.rooms.get(roomId);
      const peers = room ? roomManager.getPresenceList(room) : [];
      socket.to(roomId).emit(SERVER_EVENTS.PRESENCE_SYNC, { peers });
      await roomManager.clientLeft(roomId);
    });
  });
}
