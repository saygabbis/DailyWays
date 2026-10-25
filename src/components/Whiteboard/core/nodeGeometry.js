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

/** Folga entre a ponta do conector e a borda do nó (mundo). */
const EDGE_GAP = 6;

export function connectorWorldRect(node, byId) {
    if (!node) return null;
    const p = nodeToWorld(node, byId);
    const w = node.width || 0;
    const h = node.height || 0;
    return { cx: p.x + w / 2, cy: p.y + h / 2, hw: w / 2, hh: h / 2 };
}

/** Ponto onde a reta centro→alvo sai do retângulo (a seta fica visível, não embaixo do nó). */
export function connectorEdgePoint(r, toward) {
    const dx = toward.x - r.cx;
    const dy = toward.y - r.cy;
    if (!dx && !dy) return { x: r.cx, y: r.cy };
    const tx = dx ? (r.hw + EDGE_GAP) / Math.abs(dx) : Infinity;
    const ty = dy ? (r.hh + EDGE_GAP) / Math.abs(dy) : Infinity;
    const t = Math.min(tx, ty, 1);
    return { x: r.cx + dx * t, y: r.cy + dy * t };
}
