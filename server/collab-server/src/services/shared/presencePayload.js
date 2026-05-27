import { parseBoardIdFromRoom, parseSpaceIdFromRoom } from '@dailyways/collab-protocol';

export function createPresenceSyncPayload(roomId, peers) {
  return {
    peers,
    boardId: parseBoardIdFromRoom(roomId) || null,
    spaceId: parseSpaceIdFromRoom(roomId) || null,
    roomId,
  };
}
