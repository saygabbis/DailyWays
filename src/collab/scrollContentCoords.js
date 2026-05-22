import { screenCoordsToFixedLayer } from './pointerViewport.js';

/** Ponto de conteúdo (inclui scroll) está na área visível do painel scrollável. */
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

export function contentPointFromClient(scrollEl, clientX, clientY) {
  const rect = scrollEl.getBoundingClientRect();
  return {
    x: clientX - rect.left + scrollEl.scrollLeft,
    y: clientY - rect.top + scrollEl.scrollTop,
  };
}

/**
 * Converte coords de conteúdo → viewport fixa local.
 * Retorna null se o ponto saiu da área visível (scroll) — cursor some com o conteúdo.
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
