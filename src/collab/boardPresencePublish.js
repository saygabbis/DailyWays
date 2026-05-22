import { emitPresence } from './collabClient.js';
import { getPresenceFields } from './presenceBridge.js';
import { buildBoardPresencePayload } from './presencePayload.js';
import { getLastBoardPointer, seedBoardCursorFields } from './lastBoardPointer.js';

/** Estado local ao entrar na superfície do board (troca de board na sidebar, etc.). */
export function prepareBoardSurfacePresence(boardId) {
  if (!boardId) return;
  const f = getPresenceFields(boardId);
  f.selectedCardId = null;
  f.onBoardSurface = true;
  f.hoverCardId = null;
  f.hoverListId = null;
  f.draggingCardId = null;
  f.draggingListId = null;
}

function applySeededCursor(boardId, seeded) {
  if (!seeded) return false;
  const f = getPresenceFields(boardId);
  f.cursor = { x: seeded.x, y: seeded.y, space: 'board' };
  f.cursorScreen = seeded.cursorScreen || null;
  return true;
}

/** Ao sair do modal da task: volta cursor visível no board para os outros. */
export function restoreBoardPresenceAfterModal(boardId) {
  if (!boardId) return;
  const f = getPresenceFields(boardId);
  f.selectedCardId = null;
  f.onBoardSurface = true;
  f.hoverModalEl = null;
  f.liveDraft = null;
  f.hoverCardId = null;
  f.hoverListId = null;
  f.cursorModal = null;
  const seeded = getLastBoardPointer(boardId) || defaultBoardPointer(boardId);
  applySeededCursor(boardId, seeded);
}

/** Apply last-known or default cursor, then emit presence once (join / reconnect). */
export function publishBoardPresenceFull(socket, boardId, auth) {
  if (!socket?.connected || !boardId) return false;

  let hasCursor = applySeededCursor(boardId, seedBoardCursorFields(boardId));
  if (!hasCursor) {
    const last = getLastBoardPointer(boardId);
    hasCursor = applySeededCursor(boardId, last);
  }

  const fields = getPresenceFields(boardId);
  if (!hasCursor && fields.cursor && typeof fields.cursor.x === 'number') {
    hasCursor = true;
  }

  emitPresence(socket, buildBoardPresencePayload(boardId, auth));
  return hasCursor;
}

/** Republish until cursor is on screen or retries exhausted (F5 / remount). */
export function scheduleBoardPresencePublish(socket, boardId, auth, { maxAttempts = 12 } = {}) {
  let attempts = 0;
  const tick = () => {
    if (!socket?.connected || !boardId) return;
    const ok = publishBoardPresenceFull(socket, boardId, auth);
    attempts += 1;
    if (ok || attempts >= maxAttempts) return;
    requestAnimationFrame(tick);
  };
  tick();
}
