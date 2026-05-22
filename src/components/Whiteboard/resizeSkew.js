const DEG = 180 / Math.PI;
const MAX_SKEW = 60;

function clampSkew(deg) {
    return Math.max(-MAX_SKEW, Math.min(MAX_SKEW, deg));
}

/**
 * Redimensiona e aplica skew (distorção) ao arrastar com Control.
 * @param {{ x, y, width, height, skewX?: number, skewY?: number }} origin
 */
export function computeSkewResizeBounds(origin, handle, world, modifiers = {}) {
    const min = modifiers.min ?? 0;
    const w0 = Math.max(min, origin.width || min);
    const h0 = Math.max(min, origin.height || min);
    const right = origin.x + w0;
    const bottom = origin.y + h0;
    const skewX0 = origin.skewX ?? 0;
    const skewY0 = origin.skewY ?? 0;

    let x = origin.x;
    let y = origin.y;
    let w = w0;
    let h = h0;
    let skewX = skewX0;
    let skewY = skewY0;

    switch (handle) {
        case 'se': {
            w = Math.max(min, world.x - origin.x);
            h = Math.max(min, world.y - origin.y);
            skewX = clampSkew(Math.atan2(world.y - origin.y - h, w) * DEG);
            skewY = clampSkew(Math.atan2(world.x - origin.x - w, h) * DEG);
            break;
        }
        case 'sw': {
            x = world.x;
            w = Math.max(min, right - world.x);
            h = Math.max(min, world.y - origin.y);
            skewX = clampSkew(Math.atan2(world.y - origin.y - h, w) * DEG);
            skewY = clampSkew(Math.atan2(origin.x - world.x - w, h) * DEG * -1);
            break;
        }
        case 'ne': {
            y = world.y;
            w = Math.max(min, world.x - origin.x);
            h = Math.max(min, bottom - world.y);
            skewX = clampSkew(Math.atan2(bottom - world.y - h, w) * DEG * -1);
            skewY = clampSkew(Math.atan2(world.x - origin.x - w, h) * DEG);
            break;
        }
        case 'nw': {
            x = world.x;
            y = world.y;
            w = Math.max(min, right - world.x);
            h = Math.max(min, bottom - world.y);
            skewX = clampSkew(Math.atan2(bottom - world.y - h, w) * DEG * -1);
            skewY = clampSkew(Math.atan2(origin.x - world.x - w, h) * DEG * -1);
            break;
        }
        case 'e': {
            w = Math.max(min, world.x - origin.x);
            skewY = clampSkew(Math.atan2(world.y - (origin.y + h0 / 2), w) * DEG);
            break;
        }
        case 'w': {
            x = world.x;
            w = Math.max(min, right - world.x);
            skewY = clampSkew(Math.atan2(world.y - (origin.y + h0 / 2), w) * DEG * -1);
            break;
        }
        case 's': {
            h = Math.max(min, world.y - origin.y);
            skewX = clampSkew(Math.atan2(world.x - (origin.x + w0 / 2), h) * DEG);
            break;
        }
        case 'n': {
            y = world.y;
            h = Math.max(min, bottom - world.y);
            skewX = clampSkew(Math.atan2(world.x - (origin.x + w0 / 2), h) * DEG * -1);
            break;
        }
        default:
            break;
    }

    return {
        x,
        y,
        width: Math.max(min, w),
        height: Math.max(min, h),
        skewX,
        skewY,
    };
}
