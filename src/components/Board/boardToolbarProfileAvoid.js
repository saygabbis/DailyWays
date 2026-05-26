/** Evita sobreposição da board toolbar com o dropdown de perfil (viewport). */

/** Respiro fixo entre a zona do menu e a toolbar. */
export const PROFILE_MENU_CLEAR_GAP = 12;

/** Padding extra na caixa de colisão do menu. */
export const PROFILE_MENU_HIT_PAD_X = 8;
export const PROFILE_MENU_HIT_PAD_TOP = 4;
export const PROFILE_MENU_HIT_PAD_BOTTOM = 12;

export function rectsIntersect(a, b) {
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

export function menuCollisionZone(menuRect) {
    return {
        left: menuRect.left - PROFILE_MENU_HIT_PAD_X,
        right: menuRect.right + PROFILE_MENU_HIT_PAD_X,
        top: menuRect.top - PROFILE_MENU_HIT_PAD_TOP,
        bottom: menuRect.bottom + PROFILE_MENU_HIT_PAD_BOTTOM,
    };
}

function shiftedRect(rect, dx, dy) {
    return {
        left: rect.left + dx,
        top: rect.top + dy,
        right: rect.right + dx,
        bottom: rect.bottom + dy,
        width: rect.width,
        height: rect.height,
    };
}

function clampShift(dx, dy, toolRect, boardRect, boardPadding = 10) {
    let x = dx;
    let y = dy;
    const w = toolRect.width;
    const h = toolRect.height;

    let left = toolRect.left + x;
    let top = toolRect.top + y;

    const minLeft = boardRect.left + boardPadding;
    const minTop = boardRect.top + boardPadding;
    const maxRight = boardRect.right - boardPadding;
    const maxBottom = boardRect.bottom - boardPadding;

    if (left < minLeft) x += minLeft - left;
    if (top < minTop) y += minTop - top;
    left = toolRect.left + x;
    top = toolRect.top + y;
    if (left + w > maxRight) x -= (left + w) - maxRight;
    if (top + h > maxBottom) y -= (top + h) - maxBottom;

    return { x, y };
}

/**
 * Deslocamento mínimo em viewport (px) para a toolbar não intersectar a zona do menu.
 * Prioridade: abaixo do menu → à esquerda → acima.
 */
export function computeProfileMenuAvoidance(toolRect, menuRect, boardRect) {
    if (!toolRect?.width || !menuRect?.height) {
        return { x: 0, y: 0 };
    }

    const zone = menuCollisionZone(menuRect);
    if (!rectsIntersect(toolRect, zone)) {
        return { x: 0, y: 0 };
    }

    const gap = PROFILE_MENU_CLEAR_GAP;
    const candidates = [
        { x: 0, y: zone.bottom + gap - toolRect.top, rank: 0 },
        { x: zone.left - gap - toolRect.right, y: 0, rank: 1 },
        { x: 0, y: zone.top - gap - toolRect.bottom, rank: 2 },
        {
            x: zone.left - gap - toolRect.right,
            y: zone.bottom + gap - toolRect.top,
            rank: 3,
        },
    ];

    let best = null;
    for (const c of candidates) {
        const shifted = shiftedRect(toolRect, c.x, c.y);
        if (!rectsIntersect(shifted, zone)) {
            const clamped = clampShift(c.x, c.y, toolRect, boardRect);
            const shiftedClamped = shiftedRect(toolRect, clamped.x, clamped.y);
            if (!rectsIntersect(shiftedClamped, zone)) {
                const cost = Math.abs(clamped.x) + Math.abs(clamped.y);
                if (!best || c.rank < best.rank || (c.rank === best.rank && cost < best.cost)) {
                    best = { ...clamped, rank: c.rank, cost };
                }
            }
        }
    }

    if (best) {
        return { x: best.x, y: best.y };
    }

    const fallback = clampShift(0, zone.bottom + gap - toolRect.top, toolRect, boardRect);
    return fallback;
}
