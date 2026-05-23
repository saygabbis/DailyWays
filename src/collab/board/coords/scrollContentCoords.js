import { screenCoordsToFixedLayer } from './pointerViewport.js';

export function getBoardListsEl(scrollerEl) {
  return scrollerEl?.querySelector?.('.board-lists') ?? null;
}

/** Converte ponto .board-lists → clientX/Y na viewport (sidebar entra só via listsRect). */
export function boardScreenPointFromContent(scrollerEl, contentX, contentY) {
  const lists = getBoardListsEl(scrollerEl);
  if (!lists || typeof contentX !== 'number' || typeof contentY !== 'number') return null;
  const listsRect = lists.getBoundingClientRect();
  return {
    x: listsRect.left + contentX,
    y: listsRect.top + contentY,
  };
}

/**
 * Coordenadas relativas ao .board-lists (origem = canto das listas, não da viewport).
 * Ignora sidebar e padding do scroller na conversão — mesma base na captura e na exibição.
 */
export function boardListsContentPointFromClient(scrollerEl, clientX, clientY) {
  const lists = getBoardListsEl(scrollerEl);
  if (!lists) {
    return contentPointFromClient(scrollerEl, clientX, clientY);
  }
  const listsRect = lists.getBoundingClientRect();
  return {
    x: clientX - listsRect.left,
    y: clientY - listsRect.top,
  };
}

/** Ponto de conteúdo (fallback sem .board-lists) — espaço do scroller com scroll. */
export function contentPointFromClient(scrollEl, clientX, clientY) {
  const rect = scrollEl.getBoundingClientRect();
  return {
    x: clientX - rect.left + scrollEl.scrollLeft,
    y: clientY - rect.top + scrollEl.scrollTop,
  };
}

/** Ponto no espaço .board-lists está na área visível do scroller. */
export function isBoardListsPointInScrollView(scrollerEl, contentX, contentY, pad = 2) {
  const lists = getBoardListsEl(scrollerEl);
  if (!lists) {
    return isContentPointInScrollView(scrollerEl, contentX, contentY, pad);
  }
  const scrollerRect = scrollerEl.getBoundingClientRect();
  const listsRect = lists.getBoundingClientRect();
  const clientX = listsRect.left + contentX;
  const clientY = listsRect.top + contentY;
  return (
    clientX >= scrollerRect.left - pad
    && clientX <= scrollerRect.right + pad
    && clientY >= scrollerRect.top - pad
    && clientY <= scrollerRect.bottom + pad
  );
}

/** @deprecated Preferir isBoardListsPointInScrollView no board kanban */
export function isContentPointInScrollView(scrollEl, contentX, contentY, pad = 2) {
  if (!scrollEl || typeof contentX !== 'number' || typeof contentY !== 'number') return false;
  const sl = scrollEl.scrollLeft;
  const st = scrollEl.scrollTop;
  const vw = scrollEl.clientWidth;
  const vh = scrollEl.clientHeight;
  return (
    contentX >= sl - pad
    && contentX <= sl + vw + pad
    && contentY >= st - pad
    && contentY <= st + vh + pad
  );
}

/**
 * Converte coords de conteúdo do scroller → viewport fixa (modais / fallback).
 */
export function viewportFromContentPoint(scrollEl, contentX, contentY) {
  if (!scrollEl || !isContentPointInScrollView(scrollEl, contentX, contentY)) {
    return null;
  }
  const rect = scrollEl.getBoundingClientRect();
  return screenCoordsToFixedLayer({
    x: rect.left + contentX - scrollEl.scrollLeft,
    y: rect.top + contentY - scrollEl.scrollTop,
  });
}

export function getBoardPresenceLayerAnchor(scrollerEl) {
  const lists = getBoardListsEl(scrollerEl);
  if (!lists) {
    return { offsetLeft: 0, offsetTop: 0, width: null, height: null };
  }
  return {
    offsetLeft: lists.offsetLeft,
    offsetTop: lists.offsetTop,
    width: lists.offsetWidth,
    height: lists.offsetHeight,
  };
}
