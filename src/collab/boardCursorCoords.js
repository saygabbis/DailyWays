import { contentPointFromClient, viewportFromContentPoint } from './scrollContentCoords.js';
import { pointerCoordsFromEvent } from './pointerViewport.js';

/** Coordenadas no conteúdo do board-scroller (independe de sidebar, zoom da janela, etc.). */
export function pointerCoordsFromBoardEvent(e, scrollerEl) {
  const screen = pointerCoordsFromEvent(e);
  if (!scrollerEl) {
    return { ...screen, cursor: null };
  }
  const content = contentPointFromClient(scrollerEl, e.clientX, e.clientY);
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
  if (!scrollerEl || !c || typeof c.x !== 'number' || typeof c.y !== 'number') {
    return null;
  }
  if (peer?.selectedCardId || peer?.cursorModal) return null;
  return viewportFromContentPoint(scrollerEl, c.x, c.y);
}
