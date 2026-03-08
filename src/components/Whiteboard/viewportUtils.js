/**
 * Check if node bbox intersects viewport (in world coordinates).
 */
export function intersectsViewport(node, viewport) {
    if (!node || !viewport) return true;
    const nodeRight = node.x + (node.width || 0);
    const nodeBottom = node.y + (node.height || 0);
    const vpRight = viewport.x + viewport.width;
    const vpBottom = viewport.y + viewport.height;
    return !(
        node.x > vpRight ||
        nodeRight < viewport.x ||
        node.y > vpBottom ||
        nodeBottom < viewport.y
    );
}

/**
 * World to screen (for toolbar position etc.) - viewport div is centered, so origin at center.
 */
export function worldToScreen(x, y, viewport) {
    if (!viewport) return { x, y };
    return {
        x: x * viewport.zoom + viewport.panX,
        y: y * viewport.zoom + viewport.panY,
    };
}

/** World to client coords using container rect (transform origin at center of container). */
export function worldToScreenWithContainer(worldX, worldY, containerRect, viewport) {
    if (!viewport || !containerRect) return { x: worldX, y: worldY };
    const cx = containerRect.left + containerRect.width / 2;
    const cy = containerRect.top + containerRect.height / 2;
    return {
        x: cx + viewport.panX + worldX * viewport.zoom,
        y: cy + viewport.panY + worldY * viewport.zoom,
    };
}

export function screenToWorld(screenX, screenY, viewport) {
    if (!viewport) return { x: screenX, y: screenY };
    return {
        x: (screenX - viewport.panX) / viewport.zoom,
        y: (screenY - viewport.panY) / viewport.zoom,
    };
}

/** Convert screen (client) coords to world using viewport and container rect (transform origin at center). */
export function screenToWorldWithContainer(clientX, clientY, containerRect, viewport) {
    if (!viewport || !containerRect) return { x: clientX, y: clientY };
    const cx = containerRect.left + containerRect.width / 2;
    const cy = containerRect.top + containerRect.height / 2;
    return {
        x: (clientX - cx - viewport.panX) / viewport.zoom,
        y: (clientY - cy - viewport.panY) / viewport.zoom,
    };
}

export function rectIntersects(a, b) {
    return !(a.x + a.width < b.x || b.x + b.width < a.x || a.y + a.height < b.y || b.y + b.height < a.y);
}

/** Frame/container types that can hold child nodes. */
export const CONTAINER_NODE_TYPES = ['frame', 'column', 'table'];

/** Find topmost container node that contains (worldX, worldY). Uses world coords for roots. */
export function findContainerAt(nodes, worldX, worldY) {
    const containers = nodes
        .filter((n) => CONTAINER_NODE_TYPES.includes(n.type) && !n.parentId)
        .sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));
    for (const c of containers) {
        const x = c.x ?? 0;
        const y = c.y ?? 0;
        const width = c.width ?? 0;
        const height = c.height ?? 0;
        if (worldX >= x && worldX <= x + width && worldY >= y && worldY <= y + height) return c;
    }
    return null;
}
