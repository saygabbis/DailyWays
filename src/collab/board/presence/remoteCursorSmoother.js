const DEFAULT_LERP = 0.28;
const FAST_LERP = 0.52;
const SNAP_PX = 0.35;
const TELEPORT_PX = 140;

function roundPx(n) {
  return Math.round(n * 10) / 10;
}

/**
 * Suaviza posições de cursores remotos entre updates do socket (lerp por frame).
 */
export function createRemoteCursorSmoother(options = {}) {
  const baseLerp = options.lerp ?? DEFAULT_LERP;
  const fastLerp = options.fastLerp ?? FAST_LERP;
  const states = new Map();

  function updateTarget(userId, target) {
    if (!userId || !target || typeof target.x !== 'number' || typeof target.y !== 'number') {
      states.delete(userId);
      return;
    }
    const prev = states.get(userId);
    if (!prev) {
      states.set(userId, {
        x: target.x,
        y: target.y,
        tx: target.x,
        ty: target.y,
      });
      return;
    }
    prev.tx = target.x;
    prev.ty = target.y;
  }

  function snapTo(userId, target) {
    if (!userId || !target || typeof target.x !== 'number' || typeof target.y !== 'number') {
      return;
    }
    states.set(userId, {
      x: target.x,
      y: target.y,
      tx: target.x,
      ty: target.y,
    });
  }

  function remove(userId) {
    states.delete(userId);
  }

  function clear() {
    states.clear();
  }

  function getPosition(userId) {
    const s = states.get(userId);
    if (!s) return null;
    return { x: roundPx(s.x), y: roundPx(s.y) };
  }

  /** Avança um frame; retorna true se ainda há movimento pendente. */
  function tick() {
    let animating = false;
    for (const s of states.values()) {
      const dx = s.tx - s.x;
      const dy = s.ty - s.y;
      const dist = Math.hypot(dx, dy);
      if (dist < SNAP_PX) {
        s.x = s.tx;
        s.y = s.ty;
        continue;
      }
      const lerp = dist > TELEPORT_PX ? fastLerp : baseLerp;
      s.x += dx * lerp;
      s.y += dy * lerp;
      animating = true;
    }
    return animating;
  }

  return { updateTarget, snapTo, remove, clear, getPosition, tick };
}
