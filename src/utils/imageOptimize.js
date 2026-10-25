/**
 * Otimização de imagem no navegador antes do upload (Spaces).
 * - Reduz o lado maior para no máximo `maxEdge` e regrava em WebP quando isso deixa o arquivo menor.
 * - Gera miniatura (`thumbEdge`) para o canvas usar quando a imagem aparece pequena na tela.
 * GIF (animação) e SVG (vetor) passam intactos. Sem suporte a canvas/WebP, devolve o original.
 */

const SKIP_TYPES = new Set(['image/gif', 'image/svg+xml']);

async function decode(file) {
    if (typeof createImageBitmap === 'function') {
        try {
            return await createImageBitmap(file, { imageOrientation: 'from-image' });
        } catch {
            /* cai no <img> abaixo */
        }
    }
    const url = URL.createObjectURL(file);
    try {
        const img = new Image();
        img.decoding = 'async';
        img.src = url;
        await img.decode();
        return img;
    } finally {
        URL.revokeObjectURL(url);
    }
}

function sizeOf(source) {
    return {
        width: source.naturalWidth || source.width,
        height: source.naturalHeight || source.height,
    };
}

function encode(source, width, height, quality) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.resolve(null);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, width, height);
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b?.type === 'image/webp' ? b : null), 'image/webp', quality));
}

function fitWithin(width, height, maxEdge) {
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), scaled: scale < 1 };
}

function renameToWebp(name) {
    const base = (name || 'imagem').replace(/\.[^.]+$/, '');
    return `${base}.webp`;
}

/**
 * @returns {Promise<{ file: File, thumb: Blob|null, width: number, height: number }>}
 */
export async function optimizeImageForUpload(file, { maxEdge = 2560, thumbEdge = 512, quality = 0.86 } = {}) {
    const fallback = { file, thumb: null, width: 0, height: 0 };
    if (!file?.type?.startsWith('image/') || SKIP_TYPES.has(file.type) || typeof document === 'undefined') return fallback;
    let source;
    try {
        source = await decode(file);
    } catch {
        return fallback;
    }
    try {
        const natural = sizeOf(source);
        const main = fitWithin(natural.width, natural.height, maxEdge);
        let out = file;
        const blob = await encode(source, main.width, main.height, quality);
        // só troca se ficou menor (ou se precisou reduzir); PNG pequeno com transparência continua PNG
        if (blob && (main.scaled || blob.size < file.size * 0.9)) {
            out = new File([blob], renameToWebp(file.name), { type: 'image/webp', lastModified: Date.now() });
        }
        let thumb = null;
        const t = fitWithin(natural.width, natural.height, thumbEdge);
        if (t.scaled) thumb = await encode(source, t.width, t.height, 0.8);
        return { file: out, thumb, width: natural.width, height: natural.height };
    } catch {
        return fallback;
    } finally {
        source?.close?.();
    }
}

/** Caminho da miniatura ao lado do arquivo no bucket. */
export function thumbPathFor(storagePath) {
    if (!storagePath) return null;
    return `${storagePath.replace(/\.[^./]+$/, '')}.thumb.webp`;
}
