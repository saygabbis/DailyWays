export function shouldEmitPresenceForRoom({ requestedRoomId, joinedRoomId }) {
  if (!requestedRoomId) return true;
  if (!joinedRoomId) return true;
  return requestedRoomId === joinedRoomId;
}
