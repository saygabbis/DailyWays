import { nodeToWorld, buildNodesById } from './whiteboardNodeOps';
import { recordNodesMutation } from './whiteboardHistory';

export function getSelectionWorldBounds(selectedNodes, allNodes) {
    const byId = buildNodesById(allNodes);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const n of selectedNodes) {
        const { x, y } = nodeToWorld(n, byId);
        const w = n.width ?? 0;
        const h = n.height ?? 0;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w);
        maxY = Math.max(maxY, y + h);
    }

    if (!Number.isFinite(minX)) {
        return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0, cx: 0, cy: 0 };
    }

    return {
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX,
        height: maxY - minY,
        cx: (minX + maxX) / 2,
        cy: (minY + maxY) / 2,
    };
}

function worldToNodePatch(node, worldX, worldY, allNodes) {
    const byId = buildNodesById(allNodes);
    if (!node.parentId) {
        return { x: worldX, y: worldY };
    }
    const parent = byId.get(node.parentId);
    if (!parent) {
        return { x: worldX, y: worldY, parentId: null };
    }
    const pw = nodeToWorld(parent, byId);
    return { x: worldX - pw.x, y: worldY - pw.y };
}

/**
 * @param {'left'|'centerH'|'right'|'top'|'centerV'|'bottom'|'centerCanvas'} mode
 */
export function alignSelectedNodes(store, collabPatchNodes, mode) {
    const state = store.getState();
    const selected = state.nodes.filter((n) => state.selectedNodeIds.includes(n.id));
    if (!selected.length) return;

    const bbox = getSelectionWorldBounds(selected, state.nodes);
    const byId = buildNodesById(state.nodes);
    const patches = [];

    if (mode === 'centerCanvas') {
        const dx = -bbox.cx;
        const dy = -bbox.cy;
        for (const n of selected) {
            const world = nodeToWorld(n, byId);
            patches.push({
                id: n.id,
                patch: worldToNodePatch(n, world.x + dx, world.y + dy, state.nodes),
            });
        }
        recordNodesMutation(store, patches.map((p) => p.id), () => collabPatchNodes(patches));
        return;
    }

    for (const n of selected) {
        const world = nodeToWorld(n, byId);
        const w = n.width ?? 0;
        const h = n.height ?? 0;
        let wx = world.x;
        let wy = world.y;

        switch (mode) {
            case 'left':
                wx = bbox.minX;
                break;
            case 'centerH':
                wx = bbox.minX + (bbox.width - w) / 2;
                break;
            case 'right':
                wx = bbox.maxX - w;
                break;
            case 'top':
                wy = bbox.minY;
                break;
            case 'centerV':
                wy = bbox.minY + (bbox.height - h) / 2;
                break;
            case 'bottom':
                wy = bbox.maxY - h;
                break;
            default:
                break;
        }

        patches.push({
            id: n.id,
            patch: worldToNodePatch(n, wx, wy, state.nodes),
        });
    }

    if (patches.length) {
        recordNodesMutation(store, patches.map((p) => p.id), () => collabPatchNodes(patches));
    }
}
