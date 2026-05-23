import { buildNodesById, nodeToWorld } from '../../core/ops/whiteboardNodeOps';
import { enforceResizeAspectRatio } from '../transform/resizeBounds';
import { getSelectionWorldBounds } from '../../core/align/whiteboardAlign';
import { getNodePageId } from '../../core/pages/whiteboardPages';
import { isDescendantOf } from '../../core/layers/layerTreeUtils';

function worldBounds(node, nodesById) {
    const { x, y } = nodeToWorld(node, nodesById);
    const w = node.width ?? 0;
    const h = node.height ?? 0;
    return {
        left: x,
        top: y,
        right: x + w,
        bottom: y + h,
        cx: x + w / 2,
        cy: y + h / 2,
        width: w,
        height: h,
    };
}

function collectSnapTargets(otherNodes, nodesById, excludeIds) {
    const targets = [];
    for (const n of otherNodes) {
        if (excludeIds.has(n.id)) continue;
        const b = worldBounds(n, nodesById);
        targets.push(
            { axis: 'x', value: b.left, kind: 'edge' },
            { axis: 'x', value: b.right, kind: 'edge' },
            { axis: 'x', value: b.cx, kind: 'center' },
            { axis: 'y', value: b.top, kind: 'edge' },
            { axis: 'y', value: b.bottom, kind: 'edge' },
            { axis: 'y', value: b.cy, kind: 'center' }
        );
    }
    return targets;
}

function snapScalar(movingEdges, targets, threshold) {
    let bestDelta = null;
    let bestDist = threshold + 1;
    let bestGuide = null;

    for (const edge of movingEdges) {
        for (const t of targets) {
            if (t.axis !== edge.axis) continue;
            const delta = t.value - edge.value;
            const dist = Math.abs(delta);
            if (dist <= threshold && dist < bestDist) {
                bestDist = dist;
                bestDelta = delta;
                bestGuide = { axis: t.axis, pos: t.value };
            }
        }
    }

    return { delta: bestDelta ?? 0, guide: bestGuide };
}

/**
 * Ajusta delta de arraste com imãs estilo Figma (bordas e centros).
 * @returns {{ dx: number, dy: number, guides: Array<{ axis: 'x'|'y', pos: number }> }}
 */
export function computeSnapForDrag({
    nodes,
    movingIds,
    initialSnapshots,
    totalDx,
    totalDy,
    zoom = 1,
    pageId,
    enabled = true,
}) {
    if (!enabled) {
        return { dx: totalDx, dy: totalDy, guides: [] };
    }

    const prunedIds = new Set(movingIds);
    const movingNodes = (initialSnapshots ?? [])
        .map((s) => s.node)
        .filter((n) => n && prunedIds.has(n.id));

    if (!movingNodes.length) {
        return { dx: totalDx, dy: totalDy, guides: [] };
    }

    const byId = buildNodesById(nodes);
    const simulated = movingNodes.map((n) => ({
        ...n,
        x: (n.x ?? 0) + totalDx,
        y: (n.y ?? 0) + totalDy,
    }));

    const bbox = getSelectionWorldBounds(simulated, nodes);
    const threshold = 8 / Math.max(zoom, 0.15);

    const excludeIds = new Set(prunedIds);
    for (const id of prunedIds) {
        for (const n of nodes) {
            if (isDescendantOf(id, n.id, nodes)) excludeIds.add(n.id);
        }
    }

    const others = nodes.filter(
        (n) =>
            getNodePageId(n) === pageId &&
            !excludeIds.has(n.id) &&
            (n.width ?? 0) > 0 &&
            (n.height ?? 0) > 0
    );

    const targets = collectSnapTargets(others, byId, excludeIds);
    const guides = [];

    const xSnap = snapScalar(
        [
            { axis: 'x', value: bbox.minX },
            { axis: 'x', value: bbox.maxX },
            { axis: 'x', value: bbox.cx },
        ],
        targets,
        threshold
    );
    if (xSnap.guide) guides.push(xSnap.guide);

    const ySnap = snapScalar(
        [
            { axis: 'y', value: bbox.minY },
            { axis: 'y', value: bbox.maxY },
            { axis: 'y', value: bbox.cy },
        ],
        targets,
        threshold
    );
    if (ySnap.guide) guides.push(ySnap.guide);

    return {
        dx: totalDx + xSnap.delta,
        dy: totalDy + ySnap.delta,
        guides,
    };
}

function getResizeMovingEdges(handle, box, fromCenter) {
    const { x, y, width: w, height: h } = box;
    const edgesX = [];
    const edgesY = [];
    if (fromCenter) {
        edgesX.push({ axis: 'x', value: x + w / 2, role: 'center' });
        edgesY.push({ axis: 'y', value: y + h / 2, role: 'center' });
        return { edgesX, edgesY };
    }
    const leftHandles = new Set(['nw', 'sw', 'w']);
    const rightHandles = new Set(['ne', 'se', 'e']);
    const topHandles = new Set(['nw', 'ne', 'n']);
    const bottomHandles = new Set(['sw', 'se', 's']);
    if (leftHandles.has(handle)) edgesX.push({ axis: 'x', value: x, role: 'left' });
    if (rightHandles.has(handle)) edgesX.push({ axis: 'x', value: x + w, role: 'right' });
    if (topHandles.has(handle)) edgesY.push({ axis: 'y', value: y, role: 'top' });
    if (bottomHandles.has(handle)) edgesY.push({ axis: 'y', value: y + h, role: 'bottom' });
    return { edgesX, edgesY };
}

function applyResizeSnapDelta(box, handle, xSnap, ySnap, fromCenter, min = 0) {
    let { x, y, width: w, height: h } = box;
    const right = x + w;
    const bottom = y + h;

    if (xSnap.delta !== 0) {
        if (fromCenter) {
            x += xSnap.delta;
        } else if (['nw', 'sw', 'w'].includes(handle)) {
            x += xSnap.delta;
            w = Math.max(min, right - x);
        } else {
            w = Math.max(min, w + xSnap.delta);
        }
    }

    if (ySnap.delta !== 0) {
        if (fromCenter) {
            y += ySnap.delta;
        } else if (['nw', 'ne', 'n'].includes(handle)) {
            y += ySnap.delta;
            h = Math.max(min, bottom - y);
        } else {
            h = Math.max(min, h + ySnap.delta);
        }
    }

    return { x, y, width: Math.max(min, w), height: Math.max(min, h) };
}

/**
 * Imãs ao redimensionar (bordas que se movem com o handle).
 * @param {{ x, y, width, height }} box — caixa em coordenadas mundo
 * @returns {{ box: typeof box, guides: Array<{ axis: 'x'|'y', pos: number }> }}
 */
export function computeSnapForResize({
    box,
    handle,
    nodes,
    movingIds,
    zoom = 1,
    pageId,
    fromCenter = false,
    min = 0,
    /** Caixa inicial do resize (mesmo espaço que `box`); com Shift reaplica proporção após snap */
    originForAspect = null,
    enabled = true,
}) {
    const prunedIds = new Set(movingIds);
    if (!enabled || !box || !handle || prunedIds.size === 0) {
        return { box, guides: [] };
    }

    const byId = buildNodesById(nodes);
    const threshold = 8 / Math.max(zoom, 0.15);

    const excludeIds = new Set(prunedIds);
    for (const id of prunedIds) {
        for (const n of nodes) {
            if (isDescendantOf(id, n.id, nodes)) excludeIds.add(n.id);
        }
    }

    const others = nodes.filter(
        (n) =>
            getNodePageId(n) === pageId &&
            !excludeIds.has(n.id) &&
            (n.width ?? 0) > 0 &&
            (n.height ?? 0) > 0
    );

    const targets = collectSnapTargets(others, byId, excludeIds);
    const { edgesX, edgesY } = getResizeMovingEdges(handle, box, fromCenter);

    const xSnap = snapScalar(edgesX, targets, threshold);
    const ySnap = snapScalar(edgesY, targets, threshold);

    const guides = [];
    if (xSnap.guide) guides.push(xSnap.guide);
    if (ySnap.guide) guides.push(ySnap.guide);

    let snapped = applyResizeSnapDelta(box, handle, xSnap, ySnap, fromCenter, min);

    if (originForAspect) {
        snapped = enforceResizeAspectRatio(snapped, originForAspect, handle, fromCenter);
    }

    return { box: snapped, guides };
}
