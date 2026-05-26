import { emitPresence } from '../../core/collabClient.js';
import { boardListsContentPointFromClient, boardScreenPointFromContent } from '../coords/scrollContentCoords.js';
import { getPresenceFields } from './presenceBridge.js';
import { buildBoardPresencePayload } from './presencePayload.js';
import {
  defaultBoardPointer,
  getLastBoardPointer,
  seedBoardCursorFields,
  setLastBoardPointer,
} from './lastBoardPointer.js';

function isBoardSpaceCursor(cursor) {
  return cursor?.space === 'board'
    && typeof cursor.x === 'number'
    && typeof cursor.y === 'number';
}

/** Estado local ao entrar na superfície do board (troca de board na sidebar, etc.). */
export function prepareBoardSurfacePresence(boardId) {
  if (!boardId) return;
  const f = getPresenceFields(boardId);
  f.selectedCardId = null;
  f.onBoardSurface = true;
  f.hoverCardId = null;
  f.hoverListId = null;
  f.hoverUiKey = null;
  f.draggingCardId = null;
  f.draggingListId = null;
}

function applySeededCursor(boardId, seeded) {
  if (!seeded || typeof seeded.x !== 'number' || typeof seeded.y !== 'number') return false;
  const f = getPresenceFields(boardId);
  f.cursor = { x: seeded.x, y: seeded.y, space: 'board' };
  const scroller = typeof document !== 'undefined' ? document.querySelector('.board-scroller') : null;
  f.cursorScreen = scroller
    ? boardScreenPointFromContent(scroller, seeded.x, seeded.y)
    : (seeded.cursorScreen || null);
  setLastBoardPointer(boardId, {
    x: seeded.x,
    y: seeded.y,
    cursorScreen: f.cursorScreen || null,
  });
  return true;
}

/** Atualiza cursor do board a partir de clientX/Y (após fechar modal com rato no board). */
export function applyBoardCursorFromClient(boardId, clientX, clientY) {
  const scroller = typeof document !== 'undefined' ? document.querySelector('.board-scroller') : null;
  if (!scroller || !boardId) return false;
  const content = boardListsContentPointFromClient(scroller, clientX, clientY);
  const f = getPresenceFields(boardId);
  f.cursor = { x: content.x, y: content.y, space: 'board' };
  f.cursorScreen = boardScreenPointFromContent(scroller, content.x, content.y)
    || { x: clientX, y: clientY };
  f.cursorModal = null;
  setLastBoardPointer(boardId, {
    x: content.x,
    y: content.y,
    cursorScreen: f.cursorScreen,
  });
  return true;
}

/** Próximo pointermove dentro do scroller repõe coords e opcionalmente republica presença. */
export function scheduleBoardCursorResyncAfterModal(boardId, onSynced) {
  if (!boardId || typeof document === 'undefined') return () => {};
  const onMove = (e) => {
    document.removeEventListener('pointermove', onMove, true);
    const scroller = document.querySelector('.board-scroller');
    if (!scroller) return;
    const r = scroller.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
      return;
    }
    if (applyBoardCursorFromClient(boardId, e.clientX, e.clientY)) {
      onSynced?.();
    }
  };
  document.addEventListener('pointermove', onMove, { passive: true, capture: true });
  return () => document.removeEventListener('pointermove', onMove, true);
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
  f.hoverUiKey = null;
  f.cursorModal = null;
  if (!isBoardSpaceCursor(f.cursor)) {
    const seeded = getLastBoardPointer(boardId) || defaultBoardPointer(boardId);
    applySeededCursor(boardId, seeded);
  } else {
    const scroller = typeof document !== 'undefined' ? document.querySelector('.board-scroller') : null;
    f.cursorScreen = scroller
      ? boardScreenPointFromContent(scroller, f.cursor.x, f.cursor.y)
      : (f.cursorScreen || null);
    setLastBoardPointer(boardId, {
      x: f.cursor.x,
      y: f.cursor.y,
      cursorScreen: f.cursorScreen || null,
    });
  }
}

/** Apply last-known or default cursor, then emit presence once (join / reconnect). */
export function publishBoardPresenceFull(socket, boardId, auth) {
  if (!socket?.connected || !boardId) return false;

  const fields = getPresenceFields(boardId);
  let hasCursor = isBoardSpaceCursor(fields.cursor);
  if (!hasCursor) {
    hasCursor = applySeededCursor(boardId, seedBoardCursorFields(boardId));
  }
  if (!hasCursor) {
    hasCursor = applySeededCursor(boardId, getLastBoardPointer(boardId));
  }

  emitPresence(socket, buildBoardPresencePayload(boardId, auth));
  return hasCursor;
}

function schedulePresenceTick(fn) {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
    setTimeout(fn, 100);
    return;
  }
  requestAnimationFrame(fn);
}

/** Republish until cursor is on screen or retries exhausted (F5 / remount). */
export function scheduleBoardPresencePublish(socket, boardId, auth, { maxAttempts = 12 } = {}) {
  let attempts = 0;
  const tick = () => {
    if (!socket?.connected || !boardId) return;
    const ok = publishBoardPresenceFull(socket, boardId, auth);
    attempts += 1;
    if (ok || attempts >= maxAttempts) return;
    schedulePresenceTick(tick);
  };
  tick();
}
