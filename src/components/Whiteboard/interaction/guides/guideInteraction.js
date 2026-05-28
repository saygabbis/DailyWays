import { screenToWorldWithContainer } from '../viewport/viewportUtils';
import { filterGuidesByPage } from '../../core/guides/rulerGuides';

const HIT_THRESHOLD_PX = 6;

/**
 * @param {Array} guides
 * @param {string} pageId
 * @param {number} clientX
 * @param {number} clientY
 * @param {DOMRect} containerRect
 * @param {{ panX, panY, zoom }} viewport
 * @param {Set<string>|string[]} lockedGuideIds
 * @returns {string|null} guide id
 */
export function pickGuideAt(guides, pageId, clientX, clientY, containerRect, viewport, lockedGuideIds = []) {
    if (!containerRect || !viewport) return null;
    const locked = lockedGuideIds instanceof Set ? lockedGuideIds : new Set(lockedGuideIds ?? []);
    const pageGuides = filterGuidesByPage(guides, pageId);
    const world = screenToWorldWithContainer(clientX, clientY, containerRect, viewport);
    const thresholdWorld = HIT_THRESHOLD_PX / Math.max(viewport.zoom ?? 1, 0.15);

    let bestId = null;
    let bestDist = thresholdWorld + 1;

    for (const g of pageGuides) {
        if (locked.has(g.id)) continue;
        const dist =
            g.axis === 'x'
                ? Math.abs(world.x - g.position)
                : Math.abs(world.y - g.position);
        if (dist <= thresholdWorld && dist < bestDist) {
            bestDist = dist;
            bestId = g.id;
        }
    }
    return bestId;
}

/** Posição mundo ao arrastar guia existente (só um eixo). */
export function guidePositionFromPointer(guide, clientX, clientY, containerRect, viewport) {
    const world = screenToWorldWithContainer(clientX, clientY, containerRect, viewport);
    return guide.axis === 'x' ? world.x : world.y;
}

/** Preview ao criar guia a partir da régua. */
export function guidePreviewPositionFromRuler(axis, clientX, clientY, containerRect, viewport) {
    const world = screenToWorldWithContainer(clientX, clientY, containerRect, viewport);
    return axis === 'x' ? world.x : world.y;
}

export function isPointerOnRulerBand(clientX, clientY, containerRect, rulerSize) {
    if (!containerRect) return { horizontal: false, vertical: false };
    const left = clientX - containerRect.left;
    const top = clientY - containerRect.top;
    return {
        horizontal: top >= 0 && top < rulerSize,
        vertical: left >= 0 && left < rulerSize,
    };
}
