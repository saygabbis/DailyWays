import { parseBoardIdFromRoom, parseRoomKind, parseSpaceIdFromRoom } from '@dailyways/collab-protocol';
import {
  applyBoardRoomOp,
  flushBoardRoom,
  getBoardRoomState,
  hasBoardPendingFlush,
  loadBoardRoom,
} from '../board/boardRoomAdapter.js';
import {
  applySpaceRoomOp,
  flushSpaceRoom,
  getSpaceRoomState,
  hasSpacePendingFlush,
  loadSpaceRoom,
} from '../space/spaceRoomAdapter.js';

const runtimeContext = { parseRoomKind, parseSpaceIdFromRoom, parseBoardIdFromRoom };

const roomRuntimes = {
  board: {
    load: (roomId, opts = {}) => loadBoardRoom(roomId, { ...runtimeContext, ...opts }),
    applyOp: applyBoardRoomOp,
    flush: (roomId, room) => flushBoardRoom(room, { ...runtimeContext, roomId }),
    hasPendingFlush: hasBoardPendingFlush,
    getState: getBoardRoomState,
  },
  space: {
    load: (roomId) => loadSpaceRoom(roomId, runtimeContext),
    applyOp: applySpaceRoomOp,
    flush: (roomId, room) => flushSpaceRoom(room, { ...runtimeContext, roomId }),
    hasPendingFlush: hasSpacePendingFlush,
    getState: getSpaceRoomState,
  },
};

function resolveKind(roomId, room) {
  return room?.kind || parseRoomKind(roomId) || 'space';
}

export function getRoomRuntime(roomId, room = null) {
  const kind = resolveKind(roomId, room);
  return roomRuntimes[kind] || roomRuntimes.space;
}

export async function loadRoomState(roomId, options = {}) {
  const runtime = getRoomRuntime(roomId);
  return runtime.load(roomId, options);
}

export function applyRoomOp(roomId, room, op) {
  return getRoomRuntime(roomId, room).applyOp(room, op);
}

export async function flushRoomState(roomId, room) {
  await getRoomRuntime(roomId, room).flush(roomId, room);
}

export function hasPendingFlush(roomId, room) {
  return getRoomRuntime(roomId, room).hasPendingFlush(room);
}

export function getRoomState(roomId, room) {
  return getRoomRuntime(roomId, room).getState(room);
}
