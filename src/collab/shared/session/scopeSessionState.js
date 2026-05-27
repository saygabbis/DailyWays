const joinedRoomByScope = new Map();
const mountGenerationByScope = new Map();

function normalizeScope(scope) {
  return typeof scope === 'string' && scope.trim() ? scope.trim() : 'default';
}

export function getJoinedRoomId(scope) {
  return joinedRoomByScope.get(normalizeScope(scope)) || null;
}

export function setJoinedRoomId(scope, roomId) {
  const key = normalizeScope(scope);
  if (!roomId) {
    joinedRoomByScope.delete(key);
    return;
  }
  joinedRoomByScope.set(key, roomId);
}

export function clearJoinedRoomId(scope) {
  joinedRoomByScope.delete(normalizeScope(scope));
}

export function nextMountGeneration(scope) {
  const key = normalizeScope(scope);
  const next = (mountGenerationByScope.get(key) || 0) + 1;
  mountGenerationByScope.set(key, next);
  return next;
}

export function getMountGeneration(scope) {
  return mountGenerationByScope.get(normalizeScope(scope)) || 0;
}
