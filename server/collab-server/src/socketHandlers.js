import { appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
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

const MAX_OPS_PER_SEC = 120;
const DEBUG_LOG = join(dirname(fileURLToPath(import.meta.url)), '../../../debug-ed15fe.log');

function boardIdMatchesRoom(reqBoardId, roomId) {
  if (!reqBoardId || !roomId) return true;
  if (reqBoardId === roomId) return true;
  if (roomId === roomIdForBoard(reqBoardId)) return true;
  return parseBoardIdFromRoom(roomId) === reqBoardId;
}

function agentLog(location, message, data, hypothesisId) {
  try {
    appendFileSync(
      DEBUG_LOG,
      `${JSON.stringify({ sessionId: 'ed15fe', runId: 'post-fix', hypothesisId, location, message, data, timestamp: Date.now() })}\n`,
    );
  } catch {
    /* ignore */
  }
}

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

        const prevRoomId = socket.data.roomId;
        const alreadyInRoom = prevRoomId === roomId;

        if (prevRoomId && prevRoomId !== roomId) {
          socket.leave(prevRoomId);
          await roomManager.clientLeft(prevRoomId);
          roomManager.removePresence(prevRoomId, socket.data.userId, socket.id);
        }

        socket.data.roomId = roomId;
        socket.data.canWrite = access.canWrite;
        socket.join(roomId);
        if (!alreadyInRoom) {
          roomManager.clientJoined(roomId);
        }

        const room = await roomManager.getOrLoad(roomId);
        if (boardId && !room.board) {
          ack?.({ ok: false, error: 'Board not found' });
          return;
        }
        const state = roomManager.getRoomState(room);
        const stub = await enrichPresenceFromProfile(
          socket.data.userId,
          { userId: socket.data.userId },
          socket.data.userEmail,
        );
        roomManager.setPresence(roomId, socket.data.userId, stub, socket.id);
        const peers = roomManager.getPresenceList(room);
        agentLog('socketHandlers.js:JOIN', 'join room', {
          roomId,
          socketId: socket.id?.slice(0, 8),
          alreadyInRoom,
          peerCount: peers.length,
        }, 'H3');
        ack?.({ ok: true, ...state, peers });
        socket.emit(SERVER_EVENTS.STATE, { ...state, peers });
        socket.emit(SERVER_EVENTS.PRESENCE_SYNC, { peers });
        socket.to(roomId).emit(SERVER_EVENTS.PRESENCE_SYNC, { peers });
      } catch (err) {
        console.error('[collab-server] join error', err);
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
        agentLog('socketHandlers.js:LEAVE', 'leave skipped stale board', { reqBoard: payload.boardId, roomId, socketId: socket.id?.slice(0, 8) }, 'H2');
        ack?.({ ok: true, skipped: true, peers: [] });
        return;
      }
      socket.leave(roomId);
      const peers = roomManager.removePresence(roomId, socket.data.userId, socket.id) || [];
      agentLog('socketHandlers.js:LEAVE', 'leave room', { roomId, socketId: socket.id?.slice(0, 8), peerCount: peers.length }, 'H1-H4');
      socket.to(roomId).emit(SERVER_EVENTS.PRESENCE_SYNC, { peers });
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
      const peers = roomManager.setPresence(roomId, socket.data.userId, full, socket.id);
      socket.to(roomId).emit(SERVER_EVENTS.PRESENCE_SYNC, { peers });
    });

    socket.on('disconnect', async () => {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      socket.data.roomId = null;
      const peers = roomManager.removePresence(roomId, socket.data.userId, socket.id) || [];
      agentLog('socketHandlers.js:disconnect', 'disconnect', {
        roomId,
        socketId: socket.id?.slice(0, 8),
        peerCount: peers.length,
        keptNewerSocket: peers.some((p) => p.userId === socket.data.userId),
      }, 'H4');
      socket.to(roomId).emit(SERVER_EVENTS.PRESENCE_SYNC, { peers });
      await roomManager.clientLeft(roomId);
    });
  });
}
