import { getDefaultNodePayload } from '../nodeDefaults.js';
import { getDefaultAppearanceStyle } from '../../shared/appearanceStyle.js';
import { clampViewportZoom } from '../../interaction/viewport/viewportLimits.js';
import { hasUploadedThumb } from '../../../../services/whiteboardService';
import { thumbPathFor } from '../../../../utils/imageOptimize';

export function formatFileSizeBytes(bytes) {
    if (bytes == null) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Lê largura/altura nativa do arquivo de imagem antes do upload. */
function readImageFileDimensions(file) {
    return new Promise((resolve, reject) => {
        if (!file?.type?.startsWith('image/')) {
            reject(new Error('Not an image file'));
            return;
        }
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve({
                width: Math.max(1, Math.round(img.naturalWidth || img.width || 1)),
                height: Math.max(1, Math.round(img.naturalHeight || img.height || 1)),
            });
        };
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Could not read image dimensions'));
        };
        img.src = objectUrl;
    });
}

export function topLeftFromAnchor(anchor, width, height, anchorMode = 'center') {
    if (anchorMode === 'topleft') {
        return { x: anchor.x, y: anchor.y };
    }
    return {
        x: anchor.x - width / 2,
        y: anchor.y - height / 2,
    };
}

/**
 * Monta payload de nó image com dimensões nativas do arquivo.
 * @param {{ x: number, y: number, anchor?: 'center'|'topleft' }} placement
 */
export async function buildImageNodePayload(
    file,
    urlOrPath,
    placement,
    storagePath = null,
    viewportZoom = 1
) {
    let naturalWidth = 200;
    let naturalHeight = 150;
    try {
        const dims = await readImageFileDimensions(file);
        naturalWidth = dims.width;
        naturalHeight = dims.height;
    } catch {
        /* mantém defaults */
    }

    const z = clampViewportZoom(viewportZoom);
    const width = naturalWidth / z;
    const height = naturalHeight / z;

    const anchorMode = placement.anchor ?? 'center';
    const { x, y } = topLeftFromAnchor(placement, width, height, anchorMode);
    const payload = getDefaultNodePayload('image', x, y);
    payload.width = width;
    payload.height = height;
    const path = storagePath ?? (urlOrPath && !String(urlOrPath).startsWith('http') ? urlOrPath : null);
    payload.data = {
        ...(payload.data || {}),
        storagePath: path,
        thumbStoragePath: path && hasUploadedThumb(path) ? thumbPathFor(path) : null,
        url: path ? null : urlOrPath,
        filename: file.name,
        size: formatFileSizeBytes(file.size),
        naturalWidth,
        naturalHeight,
        objectFit: 'fill',
    };
    payload.style = {
        ...(payload.style || {}),
        appearance: getDefaultAppearanceStyle('image'),
    };
    return payload;
}
