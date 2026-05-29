import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  roomIdForSpace,
  roomIdForBoard,
  parseBoardIdFromRoom,
  parseSpaceIdFromRoom,
  validateOp,
  validatePresence,
} from '@dailyways/collab-protocol';
import { verifyToken, canAccessSpace, canAccessBoard } from '../auth/auth.js';
import { roomManager } from '../services/roomManager.js';
import { enrichPresenceFromProfile } from '../services/presenceProfile.js';
import { isDevPrankAttacker, isDevPrankHandlerEnabled } from '../auth/devAccess.js';
import { devLog } from '../devLog.js';
import { createPresenceSyncPayload } from '../services/shared/presencePayload.js';
import {
  checkOpRateLimit,
  checkAuthFailRateLimit,
  registerUserConnection,
  releaseUserConnection,
} from './rateLimit.js';

const POSITION_FIELDS = new Set(['x', 'y']);
const PRESENCE_LEAVE_GRACE_MS = 500;

function payloadRoomMatchesSocketRoom(requestedRoomId, socketRoomId) {
  if (!requestedRoomId || !socketRoomId) return true;
  if (requestedRoomId === socketRoomId) return true;
  if (socketRoomId === roomIdForBoard(requestedRoomId)) return true;
  if (socketRoomId === roomIdForSpace(requestedRoomId)) return true;
  return (
    parseBoardIdFromRoom(socketRoomId) === requestedRoomId
    || parseSpaceIdFromRoom(socketRoomId) === requestedRoomId
  );
}

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
      io.in(roomId).emit(SERVER_EVENTS.PRESENCE_SYNC, createPresenceSyncPayload(roomId, peers));
    }
  }, PRESENCE_LEAVE_GRACE_MS);
  return roomManager.getPresenceList(room);
}

function registerDevPrankHandler(io, socket) {
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
      io.in(roomId).emit(SERVER_EVENTS.PRESENCE_SYNC, createPresenceSyncPayload(roomId, peers));
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
}

export function registerSocketHandlers(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      devLog('socket.handshake auth', {
        hasToken: Boolean(token),
        tokenLen: token?.length ?? 0,
        origin: socket.handshake.headers?.origin ?? null,
      });
      if (!token) {
        if (!checkAuthFailRateLimit(socket.handshake)) {
          return next(new Error('Too many auth attempts'));
        }
        return next(new Error('Unauthorized'));
      }
      const user = await verifyToken(token);
      if (!user) {
        if (!checkAuthFailRateLimit(socket.handshake)) {
          return next(new Error('Too many auth attempts'));
        }
        return next(new Error('Unauthorized'));
      }
      const conn = registerUserConnection(user.id);
      if (!conn.ok) {
        return next(new Error(conn.reason || 'Too many connections'));
      }
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

    if (isDevPrankHandlerEnabled()) {
      registerDevPrankHandler(io, socket);
    }

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
          devLog('socket.join board not found após reload', {
            boardIdPrefix: boardId?.slice(0, 8),
          });
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
        const syncPayload = createPresenceSyncPayload(roomId, peers);
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
      if (payload?.boardId && !payloadRoomMatchesSocketRoom(payload.boardId, roomId)) {
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
      const isPositionOp = op?.entity === 'node' && POSITION_FIELDS.has(op?.field);
      const rate = checkOpRateLimit(socket.data.userId, isPositionOp);
      if (!rate.ok) {
        socket.emit(SERVER_EVENTS.REJECTED, { opId: op?.opId, reason: rate.reason });
        ack?.({ ok: false, error: rate.reason });
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
      let roomId = socket.data.roomId;
      if (!roomId && payload?.roomId) {
        const requestedRoomEntityId = payload.roomId;
        const boardAccess = await canAccessBoard(
          socket.data.userId,
          requestedRoomEntityId,
          socket.data.accessToken,
        );
        const spaceAccess = boardAccess?.access
          ? null
          : await canAccessSpace(
            socket.data.userId,
            requestedRoomEntityId,
            socket.data.accessToken,
          );
        if (boardAccess?.access || spaceAccess?.access) {
          const isBoardRoom = Boolean(boardAccess?.access);
          const targetRoom = isBoardRoom
            ? roomIdForBoard(requestedRoomEntityId)
            : roomIdForSpace(requestedRoomEntityId);
          const access = isBoardRoom ? boardAccess : spaceAccess;
          const prev = socket.data.roomId;
          if (prev && prev !== targetRoom) {
            socket.leave(prev);
            roomManager.removePresence(prev, socket.data.userId, socket.id);
          }
          const presenceRoom = await roomManager.getOrLoad(targetRoom, {
            accessToken: socket.data.accessToken,
          });
          if (isBoardRoom && !presenceRoom.board) return;
          if (!isBoardRoom && !presenceRoom.space) return;
          socket.data.roomId = targetRoom;
          socket.data.canWrite = access.canWrite;
          socket.data.boardId = isBoardRoom ? requestedRoomEntityId : null;
          socket.data.spaceId = isBoardRoom ? null : requestedRoomEntityId;
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
      if (payload?.roomId && !payloadRoomMatchesSocketRoom(payload.roomId, roomId)) {
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
      io.in(roomId).emit(SERVER_EVENTS.PRESENCE_SYNC, createPresenceSyncPayload(roomId, peers));
    });

    socket.on('disconnect', async () => {
      releaseUserConnection(socket.data.userId);
      const roomId = socket.data.roomId;
      if (!roomId) return;
      socket.data.roomId = null;
      finalizeLeavePresence(io, roomId, socket.data.userId, socket.id);
      await roomManager.clientLeft(roomId);
    });
  });
}
