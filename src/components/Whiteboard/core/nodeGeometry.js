/** Geometria mundo/local partilhada por snap, align, inspector, transform. */

export function buildNodesById(allNodes) {
    return new Map((allNodes ?? []).map((n) => [n.id, n]));
}

export function nodeToWorld(node, nodesById) {
    let x = node.x ?? 0;
    let y = node.y ?? 0;
    let pid = node.parentId;
    while (pid) {
        const parent = nodesById.get(pid);
        if (!parent) break;
        x += parent.x ?? 0;
        y += parent.y ?? 0;
        pid = parent.parentId;
    }
    return { x, y };
}

export function worldTopLeftToNodePatch(node, worldX, worldY, allNodes, extraPatch = {}) {
    const byId = buildNodesById(allNodes);
    if (!node.parentId) {
        return { x: worldX, y: worldY, ...extraPatch };
    }
    const parent = byId.get(node.parentId);
    if (!parent) {
        return { x: worldX, y: worldY, parentId: null, ...extraPatch };
    }
    const pw = nodeToWorld(parent, byId);
    return { x: worldX - pw.x, y: worldY - pw.y, ...extraPatch };
}

export function normalizeNodesForClipboard(nodes, allNodes) {
    const byId = buildNodesById(allNodes);
    return nodes.map((n) => {
        const { x, y } = nodeToWorld(n, byId);
        const copy = JSON.parse(JSON.stringify(n));
        copy.x = x;
        copy.y = y;
        copy.parentId = null;
        return copy;
    });
}
