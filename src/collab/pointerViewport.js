/**
 * Coordenadas de ponteiro alinhadas à viewport para cursores em position:fixed / portal no body.
 */
export function pointerCoordsFromEvent(e) {
  const x = e.clientX;
  const y = e.clientY;
  return {
    x,
    y,
    cursorScreen: { x, y },
  };
}

/** Ajuste quando visualViewport ≠ layout (teclado móvel, pinch-zoom). */
export function screenCoordsToFixedLayer({ x, y }) {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  if (!vv) return { x, y };
  return {
    x: x - (vv.offsetLeft || 0),
    y: y - (vv.offsetTop || 0),
  };
}
