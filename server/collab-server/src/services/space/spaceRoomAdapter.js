import { loadRoomFromDb } from '../loadRoom.js';
import { applyOpToRoom } from '../applyOp.js';
import { flushRoom } from '../../db/persistence.js';

export function createSpaceRoomState() {
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
    flushInFlight: false,
    flushRequested: false,
    flushErrorCount: 0,
    lastActivity: Date.now(),
    flushAccessToken: null,
    flushUserId: null,
  };
}

export async function loadSpaceRoom(roomId, { parseSpaceIdFromRoom, accessToken }) {
  const spaceId = parseSpaceIdFromRoom(roomId);
  const data = spaceId && accessToken ? await loadRoomFromDb(spaceId, accessToken) : {};
  return { ...createSpaceRoomState(), ...data };
}

export function applySpaceRoomOp(room, op, ctx = {}) {
  return applyOpToRoom(room, op, { userId: ctx.userId });
}

export async function flushSpaceRoom(room, { parseSpaceIdFromRoom, roomId }) {
  const spaceId = parseSpaceIdFromRoom(roomId);
  if (!spaceId) return;
  await flushRoom(room, spaceId);
}

export function hasSpacePendingFlush(room) {
  return (
    room?.dirty?.nodes?.size > 0
    || room?.dirty?.connectors?.size > 0
    || room?.dirty?.comments?.size > 0
    || room?.deleted?.nodes?.size > 0
    || room?.deleted?.connectors?.size > 0
    || room?.deleted?.comments?.size > 0
  );
}

export function getSpaceRoomState(room) {
  return {
    nodes: room.nodes,
    connectors: room.connectors,
    comments: room.comments,
    revision: room.revision,
  };
}
