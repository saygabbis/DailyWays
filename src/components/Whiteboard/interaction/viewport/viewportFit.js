const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;

/** Centraliza e ajusta zoom para caber os nós no container (origem no centro). */
export function computeViewportToFitNodes(nodes, containerRect, padding = 80) {
    if (!containerRect?.width || !containerRect?.height) {
        return { pan: { x: 0, y: 0 }, zoom: 1 };
    }
    if (!nodes?.length) {
        return { pan: { x: 0, y: 0 }, zoom: 1 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const n of nodes) {
        const x = n.x ?? 0;
        const y = n.y ?? 0;
        const w = n.width ?? 0;
        const h = n.height ?? 0;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w);
        maxY = Math.max(maxY, y + h);
    }

    const worldW = Math.max(maxX - minX, 80);
    const worldH = Math.max(maxY - minY, 80);
    const availW = Math.max(containerRect.width - padding, 40);
    const availH = Math.max(containerRect.height - padding, 40);
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(availW / worldW, availH / worldH)));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    return {
        pan: { x: -cx * zoom, y: -cy * zoom },
        zoom,
    };
}
