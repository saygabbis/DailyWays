import { pointerCoordsFromEvent } from './pointerViewport.js';
import { contentPointFromClient, viewportFromContentPoint } from './scrollContentCoords.js';

/** Região com scroll independente dentro do modal da task. */
export function findTaskModalScrollRegion(target, modalRoot) {
  if (!modalRoot || !target) return null;
  const body = target.closest?.('.task-detail-body');
  if (body && modalRoot.contains(body)) return { region: 'body', el: body };
  const sidebar = target.closest?.('.task-detail-sidebar');
  if (sidebar && modalRoot.contains(sidebar)) return { region: 'sidebar', el: sidebar };
  return null;
}

function scrollRegionElement(modalRoot, region) {
  if (!modalRoot) return null;
  const sel = region === 'sidebar' ? '.task-detail-sidebar' : '.task-detail-body';
  return modalRoot.querySelector(sel);
}

/** Publica cursor em coords de conteúdo (inclui scrollTop) + viewport para backdrop. */
export function pointerCoordsFromTaskModalEvent(e, modalRoot) {
  const screen = pointerCoordsFromEvent(e);
  if (!modalRoot || !e.target?.closest?.('.task-detail-modal')) {
    return { ...screen, cursorModal: null };
  }
  const hit = findTaskModalScrollRegion(e.target, modalRoot);
  if (!hit?.el) {
    return { ...screen, cursorModal: null };
  }
  const content = contentPointFromClient(hit.el, e.clientX, e.clientY);
  return {
    ...screen,
    cursorModal: {
      region: hit.region,
      x: content.x,
      y: content.y,
    },
  };
}

/** Converte coords de conteúdo do peer para viewport local (respeita scroll desta aba). */
export function taskModalCursorToViewport(cursorModal, modalRoot) {
  if (!cursorModal || !modalRoot || typeof cursorModal.x !== 'number') return null;
  const scrollEl = scrollRegionElement(modalRoot, cursorModal.region);
  if (!scrollEl) return null;
  return viewportFromContentPoint(scrollEl, cursorModal.x, cursorModal.y);
}
