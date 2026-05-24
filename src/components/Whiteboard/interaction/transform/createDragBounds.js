/** Caixa em coordenadas mundo a partir de dois cantos (âncora = ponto do primeiro clique). */
export function worldBoxFromAnchor(anchor, current, minSize = 0) {
    return worldBoxFromAnchorWithModifiers(anchor, current, { minSize });
}

/**
 * Caixa de criação por arrasto com modificadores (Shift = aspect ratio, Alt = expandir do centro).
 * @param {{ x: number, y: number }} anchor — ponto inicial (canto ou centro com Alt)
 * @param {{ x: number, y: number }} current — cursor atual
 * @param {{ minSize?: number, shiftKey?: boolean, altKey?: boolean, aspectRatio?: number }} modifiers
 */
export function worldBoxFromAnchorWithModifiers(anchor, current, modifiers = {}) {
    const min = modifiers.minSize ?? 0;
    const shiftKey = !!modifiers.shiftKey;
    const altKey = !!modifiers.altKey;
    const aspect = modifiers.aspectRatio > 0 && Number.isFinite(modifiers.aspectRatio)
        ? modifiers.aspectRatio
        : 1;

    if (altKey) {
        let halfW = Math.abs(current.x - anchor.x);
        let halfH = Math.abs(current.y - anchor.y);

        if (shiftKey) {
            if (halfW >= halfH) {
                halfH = halfW / aspect;
            } else {
                halfW = halfH * aspect;
            }
        }

        const width = Math.max(min, halfW * 2);
        const height = Math.max(min, halfH * 2);
        return {
            x: anchor.x - width / 2,
            y: anchor.y - height / 2,
            width,
            height,
        };
    }

    let width = Math.max(min, Math.abs(current.x - anchor.x));
    let height = Math.max(min, Math.abs(current.y - anchor.y));

    if (shiftKey) {
        if (width >= height) {
            height = Math.max(min, width / aspect);
        } else {
            width = Math.max(min, height * aspect);
        }
    }

    const x = current.x >= anchor.x ? anchor.x : anchor.x - width;
    const y = current.y >= anchor.y ? anchor.y : anchor.y - height;

    return { x, y, width, height };
}
