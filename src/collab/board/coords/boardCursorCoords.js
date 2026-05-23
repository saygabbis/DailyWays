import {
  boardListsContentPointFromClient,
  boardScreenPointFromContent,
  isBoardListsPointInScrollView,
} from './scrollContentCoords.js';
import { pointerCoordsFromEvent, screenCoordsToFixedLayer } from './pointerViewport.js';

/** Ajuste fino na exibição (cursores remotos + drag ghost) */
const BOARD_CURSOR_NUDGE = { x: 20, y: 20 };

/** Posição de exibição = ponto de conteúdo + nudge; ponta alinhada via transform-origin no CSS */
export function boardCursorDisplayPoint(contentPoint) {
  if (!contentPoint) return null;
  return {
    x: contentPoint.x + BOARD_CURSOR_NUDGE.x,
    y: contentPoint.y + BOARD_CURSOR_NUDGE.y,
  };
}

/** Coordenadas no conteúdo do board (relativas a .board-lists — independente da sidebar). */
export function pointerCoordsFromBoardEvent(e, scrollerEl) {
  const screen = pointerCoordsFromEvent(e);
  if (!scrollerEl) {
    return { ...screen, cursor: null };
  }
  const content = boardListsContentPointFromClient(scrollerEl, e.clientX, e.clientY);
  return {
    ...screen,
    x: content.x,
    y: content.y,
    cursor: { x: content.x, y: content.y, space: 'board' },
    cursorModal: null,
  };
}

export function boardContentCursorToViewport(peer, scrollerEl) {
  const c = peer?.cursor;
  if (!scrollerEl || c?.space !== 'board' || typeof c.x !== 'number' || typeof c.y !== 'number') {
    return null;
  }
  const isDragging = Boolean(peer?.draggingCardId || peer?.draggingListId);
  if (!isDragging && (peer?.selectedCardId || peer?.cursorModal)) return null;
  if (!isBoardListsPointInScrollView(scrollerEl, c.x, c.y)) return null;
  const screen = boardScreenPointFromContent(scrollerEl, c.x, c.y);
  if (!screen) return null;
  return screenCoordsToFixedLayer(screen);
}

/**
 * Posição no espaço .board-lists (rola com o conteúdo; mesma origem na captura e na exibição).
 */
export function boardContentCursorPosition(peer, scrollerEl) {
  const c = peer?.cursor;
  if (!scrollerEl || c?.space !== 'board' || typeof c.x !== 'number' || typeof c.y !== 'number') {
    return null;
  }
  const isDragging = Boolean(peer?.draggingCardId || peer?.draggingListId);
  if (!isDragging && (peer?.selectedCardId || peer?.cursorModal)) return null;
  if (!isBoardListsPointInScrollView(scrollerEl, c.x, c.y)) return null;
  return boardCursorDisplayPoint({ x: c.x, y: c.y });
}
