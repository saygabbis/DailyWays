/** Guarda JWT do último editor com escrita para flush com RLS. */
export function noteRoomFlushContext(room, { accessToken, userId } = {}) {
  if (!room) return;
  if (accessToken) room.flushAccessToken = accessToken;
  if (userId) room.flushUserId = userId;
}
