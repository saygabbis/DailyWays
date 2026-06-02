import { IMAGE_RESIZE_MIN_WORLD } from '../viewport/viewportLimits.js';

/** Modo de resize ao iniciar drag no handle (imagem: Ctrl = crop, outros: Ctrl = skew). */
export function getImageResizeStartMode(nodeType, ctrlKey) {
    if (nodeType === 'image' && ctrlKey) return 'crop';
    if (ctrlKey) return 'skew';
    return 'resize';
}

/** Skew só para nós que não são imagem. */
export function shouldUseSkewResize(node, ctrlKey, mode) {
    if (node?.type === 'image') return false;
    return mode === 'skew' || ctrlKey;
}

/** Shift na imagem trava a proporção nativa do arquivo, não a caixa distorcida. */
export function buildImageResizeModifiers(node, origin, event) {
    const modifiers = {
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        min: node?.type === 'image' ? IMAGE_RESIZE_MIN_WORLD : 0,
    };
    if (node?.type !== 'image') return modifiers;
    const nw = node.data?.naturalWidth ?? origin?.width;
    const nh = node.data?.naturalHeight ?? origin?.height;
    if (event.shiftKey && nw > 0 && nh > 0) {
        modifiers.aspectRatio = nw / nh;
    }
    return modifiers;
}

/** Ctrl = recorte (cover); sem Ctrl = esticar com a caixa (fill). Shift/Alt não mantêm crop. */
export function mergeImageObjectFitPatch(node, patch, event) {
    if (node?.type !== 'image') return patch;
    const objectFit = event.ctrlKey || event.metaKey ? 'cover' : 'fill';
    if ((node.data?.objectFit ?? 'fill') === objectFit) return patch;
    return {
        ...patch,
        data: { ...(node.data || {}), objectFit },
    };
}

export function getImageObjectFit(node) {
    return node?.data?.objectFit === 'cover' ? 'cover' : 'fill';
}
