import { nodeToWorld } from './whiteboardNodeOps';

export function getNodeCenterWorld(node, allNodes) {
    const byId = new Map((allNodes ?? []).map((n) => [n.id, n]));
    const { x, y } = nodeToWorld(node, byId);
    const w = node.width ?? 0;
    const h = node.height ?? 0;
    return { x: x + w / 2, y: y + h / 2 };
}

export function pointerWorldAngleDeg(cx, cy, worldX, worldY) {
    return (Math.atan2(worldY - cy, worldX - cx) * 180) / Math.PI;
}

export function computeRotationFromPointer(originRotation, startAngle, currentAngle, shiftKey) {
    let rotation = originRotation + (currentAngle - startAngle);
    if (shiftKey) {
        rotation = Math.round(rotation / 15) * 15;
    }
    return rotation;
}
