import { loadBoardFromDb } from '../loadBoard.js';
import { applyBoardOpToRoom } from '../applyBoardOp.js';
import { flushBoard } from '../flushBoard.js';

export function createBoardRoomState() {
  return {
    kind: 'board',
    board: null,
    revision: 0,
    dirty: false,
    presence: new Map(),
    presenceSockets: new Map(),
    clientCount: 0,
    flushTimer: null,
    flushInFlight: false,
    flushRequested: false,
    flushErrorCount: 0,
    lastActivity: Date.now(),
  };
}

export async function loadBoardRoom(roomId, { parseBoardIdFromRoom, accessToken }) {
  const boardId = parseBoardIdFromRoom(roomId);
  const data = boardId
    ? await loadBoardFromDb(boardId, accessToken)
    : { board: null };
  return {
    ...createBoardRoomState(),
    board: data.board,
    revision: data.revision ?? 0,
  };
}

export function applyBoardRoomOp(room, op) {
  return applyBoardOpToRoom(room, op);
}

export async function flushBoardRoom(room) {
  await flushBoard(room);
}

export function hasBoardPendingFlush(room) {
  return Boolean(room?.dirty);
}

export function getBoardRoomState(room) {
  return {
    board: room.board,
    revision: room.revision,
  };
}
