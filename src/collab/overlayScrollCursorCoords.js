import { pointerCoordsFromEvent } from './pointerViewport.js';
import { contentPointFromClient, viewportFromContentPoint } from './scrollContentCoords.js';

/** Overlay genérico com um painel scrollável (ex.: detalhes da lista). */
export function pointerCoordsFromOverlayScrollEvent(e, modalRoot, scrollSelector) {
  const screen = pointerCoordsFromEvent(e);
  if (!modalRoot || !scrollSelector || !modalRoot.contains(e.target)) {
    return { ...screen, cursorModal: null };
  }
  const scrollEl = modalRoot.querySelector(scrollSelector);
  if (!scrollEl || !scrollEl.contains(e.target)) {
    return { ...screen, cursorModal: null };
  }
  const content = contentPointFromClient(scrollEl, e.clientX, e.clientY);
  return {
    ...screen,
    cursorModal: {
      region: 'main',
      x: content.x,
      y: content.y,
    },
  };
}

export function overlayScrollCursorToViewport(cursorModal, modalRoot, scrollSelector) {
  if (!cursorModal || !modalRoot || cursorModal.region !== 'main') return null;
  const scrollEl = modalRoot.querySelector(scrollSelector);
  if (!scrollEl) return null;
  return viewportFromContentPoint(scrollEl, cursorModal.x, cursorModal.y);
}
