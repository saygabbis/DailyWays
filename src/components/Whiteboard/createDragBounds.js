/** Caixa em coordenadas mundo a partir de dois cantos (âncora = ponto do primeiro clique). */
export function worldBoxFromAnchor(anchor, current, minSize = 0) {
    const x = Math.min(anchor.x, current.x);
    const y = Math.min(anchor.y, current.y);
    const width = Math.max(minSize, Math.abs(current.x - anchor.x));
    const height = Math.max(minSize, Math.abs(current.y - anchor.y));
    return { x, y, width, height };
}
