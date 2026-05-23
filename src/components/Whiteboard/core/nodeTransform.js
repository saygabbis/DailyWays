/** Estilo CSS de rotação + skew para nós do whiteboard. */
export function getNodeTransformStyle(node) {
    const rot = node.rotation ?? 0;
    const skewX = node.skewX ?? 0;
    const skewY = node.skewY ?? 0;
    const parts = [];
    if (rot) parts.push(`rotate(${rot}deg)`);
    if (skewX) parts.push(`skewX(${skewX}deg)`);
    if (skewY) parts.push(`skewY(${skewY}deg)`);
    if (!parts.length) return {};
    return { transform: parts.join(' '), transformOrigin: 'center center' };
}
