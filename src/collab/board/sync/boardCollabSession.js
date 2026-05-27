import {
  getJoinedRoomId,
  setJoinedRoomId,
  clearJoinedRoomId,
  nextMountGeneration,
  getMountGeneration,
} from '../../shared/session/scopeSessionState.js';

const BOARD_SCOPE = 'board';

export function getGlobalJoinedBoardId() {
  return getJoinedRoomId(BOARD_SCOPE);
}

export function setGlobalJoinedBoardId(boardId) {
  setJoinedRoomId(BOARD_SCOPE, boardId || null);
}

export function clearGlobalJoinedBoardId() {
  clearJoinedRoomId(BOARD_SCOPE);
}

export function nextBoardCollabMountGen() {
  return nextMountGeneration(BOARD_SCOPE);
}

export function getBoardCollabMountGen() {
  return getMountGeneration(BOARD_SCOPE);
}
