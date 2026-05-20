export const OP_TYPES = ['create', 'update', 'delete'];
export const ENTITIES = ['node', 'connector', 'comment', 'board'];

/** Reducer action types allowed for board sync */
export const BOARD_ACTION_TYPES = new Set([
  'MOVE_CARD', 'UPDATE_CARD', 'ADD_CARD', 'DELETE_CARD',
  'ADD_LIST', 'UPDATE_LIST', 'DELETE_LIST', 'MOVE_LIST',
  'TOGGLE_SUBTASK', 'ADD_SUBTASK', 'UPDATE_SUBTASK', 'DELETE_SUBTASK',
  'UPDATE_BOARD',
]);
export const NODE_TYPES = [
  'sticky_note', 'text', 'shape', 'frame', 'connector', 'image', 'comment',
  'link', 'todo_list', 'file_card', 'drawing', 'column', 'table',
];

/** High-frequency fields (throttle on client). */
export const THROTTLE_FIELDS = new Set(['position', 'size', 'bounds']);

/** Text-like fields (debounce on client). */
export const DEBOUNCE_FIELDS = new Set(['data', 'style', 'message']);

export const UPDATE_FIELDS = new Set([
  'position', 'size', 'bounds', 'transform', 'data', 'style', 'parentId', 'zIndex',
  'controlPoints', 'message', 'nodeId', 'x', 'y', 'type', 'action',
]);

export const CLIENT_EVENTS = {
  JOIN: 'room:join',
  LEAVE: 'room:leave',
  OP: 'op:submit',
  PRESENCE: 'presence:update',
};

export const SERVER_EVENTS = {
  STATE: 'room:state',
  APPLIED: 'op:applied',
  REJECTED: 'op:rejected',
  PRESENCE_SYNC: 'presence:sync',
  ERROR: 'collab:error',
};

export function roomIdForSpace(spaceId) {
  return `space:${spaceId}`;
}

export function parseSpaceIdFromRoom(roomId) {
  if (!roomId || !roomId.startsWith('space:')) return null;
  return roomId.slice(6);
}

export function roomIdForBoard(boardId) {
  return `board:${boardId}`;
}

export function parseBoardIdFromRoom(roomId) {
  if (!roomId || !roomId.startsWith('board:')) return null;
  return roomId.slice(6);
}

export function parseRoomKind(roomId) {
  if (roomId?.startsWith('space:')) return 'space';
  if (roomId?.startsWith('board:')) return 'board';
  return null;
}
