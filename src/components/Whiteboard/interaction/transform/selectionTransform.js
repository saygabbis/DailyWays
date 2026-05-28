import { buildNodesById, nodeToWorld, worldTopLeftToNodePatch } from '../../core/ops/whiteboardNodeOps';
import { getSelectionWorldBounds } from '../../core/align/whiteboardAlign';
import { resolveDragNodeIds } from '../../core/selection/whiteboardSelectionUtils';

export const SELECTION_TRANSFORM_ID = '__selection_transform__';

export function getTransformTargetIds(
    selectedNodeIds,
    nodes,
    { groupDrill = null, isolateSelection = false } = {}
) {
    if (!selectedNodeIds?.length) return [];
    return resolveDragNodeIds(selectedNodeIds, nodes, { groupDrill, isolateSelection });
}

/** Caixa mínima 1×1 para handles de resize/rotação unificados. */
export function getUnifiedSelectionBox(nodes, transformIds) {
    const selected = nodes.filter((n) => transformIds.includes(n.id));
    if (!selected.length) return null;
    const bbox = getSelectionWorldBounds(selected, nodes);
    const width = Math.max(bbox.width || 0, 1);
    const height = Math.max(bbox.height || 0, 1);
    return {
        minX: bbox.minX,
        minY: bbox.minY,
        width,
        height,
        cx: bbox.minX + width / 2,
        cy: bbox.minY + height / 2,
    };
}

export function shouldUseUnifiedTransform(
    selectedNodeIds,
    nodes,
    selectionContext = {}
) {
    return getTransformTargetIds(selectedNodeIds, nodes, selectionContext).length > 1;
}

export function buildPseudoNodeForSelection(nodes, transformIds) {
    const box = getUnifiedSelectionBox(nodes, transformIds);
    if (!box) return null;
    return {
        id: SELECTION_TRANSFORM_ID,
        x: box.minX,
        y: box.minY,
        width: box.width,
        height: box.height,
        rotation: 0,
    };
}

/** Redimensiona todos os nós proporcionalmente ao bbox unificado. */
export function computeMultiResizePatches(snapshots, allNodes, originBox, newBox) {
    const byId = buildNodesById(allNodes);
    const ow = originBox.width || 0;
    const oh = originBox.height || 0;
    if (ow <= 0 && oh <= 0) return [];
    const effOw = Math.max(ow, 1);
    const effOh = Math.max(oh, 1);

    const ox = originBox.x;
    const oy = originBox.y;
    const nw = newBox.width ?? 0;
    const nh = newBox.height ?? 0;
    const safeOw = effOw;
    const safeOh = effOh;

    return snapshots.map(({ id, node }) => {
        const world = nodeToWorld(node, byId);
        const w = node.width ?? 0;
        const h = node.height ?? 0;
        const relX = (world.x - ox) / safeOw;
        const relY = (world.y - oy) / safeOh;
        const relW = w > 0 ? w / safeOw : 0;
        const relH = h > 0 ? h / safeOh : 0;
        const nwx = newBox.x + relX * nw;
        const nwy = newBox.y + relY * nh;
        return {
            id,
            patch: worldTopLeftToNodePatch(node, nwx, nwy, allNodes, {
                width: Math.max(0, relW * nw),
                height: Math.max(0, relH * nh),
            }),
        };
    });
}

/** Roda todos os nós em torno do centro do bbox unificado. */
export function computeMultiRotatePatches(snapshots, allNodes, center, deltaDeg) {
    const rad = (deltaDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const byId = buildNodesById(allNodes);

    return snapshots.map(({ id, node }) => {
        const world = nodeToWorld(node, byId);
        const w = node.width ?? 0;
        const h = node.height ?? 0;
        const cx = world.x + w / 2;
        const cy = world.y + h / 2;
        const dx = cx - center.x;
        const dy = cy - center.y;
        const ncx = center.x + dx * cos - dy * sin;
        const ncy = center.y + dx * sin + dy * cos;
        const rotation = (node.rotation ?? 0) + deltaDeg;
        return {
            id,
            patch: worldTopLeftToNodePatch(node, ncx - w / 2, ncy - h / 2, allNodes, { rotation }),
        };
    });
}

export function getSelectionTransformCenter(nodes, transformIds) {
    const selected = nodes.filter((n) => transformIds.includes(n.id));
    const bbox = getSelectionWorldBounds(selected, nodes);
    return { x: bbox.cx, y: bbox.cy };
}
