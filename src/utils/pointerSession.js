/**
 * Coordenadas unificadas (mouse + touch via Pointer Events).
 * @param {PointerEvent | MouseEvent} e
 */
export function clientXY(e) {
  return { x: e.clientX, y: e.clientY };
}

/**
 * Distância entre dois toques (pinch).
 */
export function touchPairDistance(touches) {
  if (touches.length < 2) return 0;
  const a = touches[0];
  const b = touches[1];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}
