import { emitPresence } from './collabClient.js';
import { getPresenceFields } from './presenceBridge.js';
import { buildBoardPresencePayload } from './presencePayload.js';
import { seedBoardCursorFields } from './lastBoardPointer.js';

/** Apply last-known or default cursor, then emit presence once (join / reconnect). */
export function publishBoardPresenceFull(socket, boardId, auth) {
  if (!socket?.connected || !boardId) return;

  const seeded = seedBoardCursorFields(boardId);
  if (seeded) {
    const f = getPresenceFields(boardId);
    f.cursor = { x: seeded.x, y: seeded.y, mode: 'screen' };
    f.cursorScreen = seeded.cursorScreen || null;
  }

  emitPresence(socket, buildBoardPresencePayload(boardId, auth));
}
