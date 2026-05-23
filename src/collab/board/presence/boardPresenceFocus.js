import { getPresenceFields } from './presenceBridge.js';
import { announcePresence } from './presenceBridge.js';
import { setLastBoardPointer } from './lastBoardPointer.js';

/** Marca se o utilizador está focado na superfície do board (sem overlay / fora da área). */
export function applyBoardPresenceFocus(boardId, focused) {
  if (!boardId) return;
  const f = getPresenceFields(boardId);
  f.onBoardSurface = !!focused;
  if (!focused && !f.selectedCardId && !f.draggingCardId && !f.draggingListId) {
    f.cursor = null;
    f.cursorScreen = null;
    f.cursorModal = null;
    f.hoverCardId = null;
    f.hoverListId = null;
    f.hoverModalEl = null;
    f.liveDraft = null;
  }
}

export function publishBoardPresenceFocus(boardId, focused) {
  applyBoardPresenceFocus(boardId, focused);
  announcePresence(boardId);
}

/** Modal da task: fora da superfície do board mas mantém cursor do board para restaurar ao sair. */
export function applyTaskModalPresence(boardId) {
  if (!boardId) return;
  const f = getPresenceFields(boardId);
  if (f.cursor?.space === 'board' && typeof f.cursor.x === 'number' && typeof f.cursor.y === 'number') {
    setLastBoardPointer(boardId, {
      x: f.cursor.x,
      y: f.cursor.y,
      cursorScreen: f.cursorScreen || null,
    });
  }
  f.onBoardSurface = false;
}
