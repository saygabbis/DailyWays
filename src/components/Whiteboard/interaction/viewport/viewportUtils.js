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

/** Converte coordenadas de cliente (getBoundingClientRect) para o espaço local do container. */
export function clientToContainerLocal(clientX, clientY, containerRect) {
    if (!containerRect) return { x: clientX, y: clientY };
    return {
        x: clientX - containerRect.left,
        y: clientY - containerRect.top,
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

import { clampViewportZoom } from './viewportLimits.js';

export { clampViewportZoom, formatViewportZoomPercent, VIEWPORT_ZOOM_MIN, VIEWPORT_ZOOM_MAX } from './viewportLimits.js';

/** Aplica zoom mantendo o ponto do cursor fixo no mundo (origem no centro do container). */
export function zoomViewportAtClient(pan, zoom, clientX, clientY, containerRect, zoomFactor) {
    const newZoom = clampViewportZoom(zoom * zoomFactor);
    if (!containerRect) {
        return { pan, zoom: newZoom };
    }
    if (newZoom === zoom) {
        return { pan, zoom: newZoom };
    }
    const mx = clientX - containerRect.left - containerRect.width / 2;
    const my = clientY - containerRect.top - containerRect.height / 2;
    const ratio = newZoom / zoom;
    return {
        pan: {
            x: mx * (1 - ratio) + pan.x * ratio,
            y: my * (1 - ratio) + pan.y * ratio,
        },
        zoom: newZoom,
    };
}

export function rectIntersects(a, b) {
    return !(a.x + a.width < b.x || b.x + b.width < a.x || a.y + a.height < b.y || b.y + b.height < a.y);
}

/** Retângulo visível em coordenadas de mundo (origem no centro do container). */
export function computeWorldViewportBounds(viewport, containerWidth, containerHeight, marginPx = 400) {
    const z = clampViewportZoom(Number(viewport?.zoom) || 1);
    const panX = Number(viewport?.panX ?? viewport?.pan?.x) || 0;
    const panY = Number(viewport?.panY ?? viewport?.pan?.y) || 0;
    const W = Math.max(1, Number(containerWidth) || 1920);
    const H = Math.max(1, Number(containerHeight) || 1080);
    const margin = marginPx / z;
    const centerX = -panX / z;
    const centerY = -panY / z;
    return {
        x: centerX - W / (2 * z) - margin,
        y: centerY - H / (2 * z) - margin,
        width: W / z + margin * 2,
        height: H / z + margin * 2,
    };
}

/** Frame/container types that can hold child nodes. */
export const CONTAINER_NODE_TYPES = ['frame', 'table'];

/** Find topmost container node that contains (worldX, worldY). Uses world coords for roots. */
export function findContainerAt(nodes, worldX, worldY) {
    const byId = new Map((nodes ?? []).map((n) => [n.id, n]));
    const worldPosCache = new Map();
    const depthCache = new Map();

    const getWorldPos = (node) => {
        if (!node) return { x: 0, y: 0 };
        if (worldPosCache.has(node.id)) return worldPosCache.get(node.id);
        if (!node.parentId) {
            const pos = { x: node.x ?? 0, y: node.y ?? 0 };
            worldPosCache.set(node.id, pos);
            return pos;
        }
        const parent = byId.get(node.parentId);
        const parentPos = getWorldPos(parent);
        const pos = {
            x: parentPos.x + (node.x ?? 0),
            y: parentPos.y + (node.y ?? 0),
        };
        worldPosCache.set(node.id, pos);
        return pos;
    };

    const getDepth = (node) => {
        if (!node) return 0;
        if (depthCache.has(node.id)) return depthCache.get(node.id);
        const parent = node.parentId ? byId.get(node.parentId) : null;
        const depth = parent ? getDepth(parent) + 1 : 0;
        depthCache.set(node.id, depth);
        return depth;
    };

    const containers = (nodes ?? [])
        .filter((n) => CONTAINER_NODE_TYPES.includes(n.type))
        .map((node) => ({ node, world: getWorldPos(node), depth: getDepth(node) }))
        .sort((a, b) => {
            if (a.depth !== b.depth) return b.depth - a.depth;
            return (b.node.zIndex ?? 0) - (a.node.zIndex ?? 0);
        });

    for (const entry of containers) {
        const { node, world } = entry;
        const width = node.width ?? 0;
        const height = node.height ?? 0;
        if (
            worldX >= world.x &&
            worldX <= world.x + width &&
            worldY >= world.y &&
            worldY <= world.y + height
        ) {
            return node;
        }
    }
    return null;
}
