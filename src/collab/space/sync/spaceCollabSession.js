import {
  getJoinedRoomId,
  setJoinedRoomId,
  clearJoinedRoomId,
  nextMountGeneration,
  getMountGeneration,
} from '../../shared/session/scopeSessionState.js';

const SPACE_SCOPE = 'space';

export function getGlobalJoinedSpaceId() {
  return getJoinedRoomId(SPACE_SCOPE);
}

export function setGlobalJoinedSpaceId(spaceId) {
  setJoinedRoomId(SPACE_SCOPE, spaceId || null);
}

export function clearGlobalJoinedSpaceId() {
  clearJoinedRoomId(SPACE_SCOPE);
}

export function nextSpaceCollabMountGen() {
  return nextMountGeneration(SPACE_SCOPE);
}

export function getSpaceCollabMountGen() {
  return getMountGeneration(SPACE_SCOPE);
}
