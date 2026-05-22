import { getPresenceFields } from './presenceBridge.js';
import { announcePresence } from './presenceBridge.js';

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

/** Modal da task: fora da superfície do board mas mantém cursor para co-presença. */
export function applyTaskModalPresence(boardId) {
  if (!boardId) return;
  const f = getPresenceFields(boardId);
  f.onBoardSurface = false;
}
