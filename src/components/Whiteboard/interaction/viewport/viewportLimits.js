/** Zoom do canvas — faixa amplia estilo PureRef, limitada para precisão float/CSS. */
export const VIEWPORT_ZOOM_MIN = 1e-4;
export const VIEWPORT_ZOOM_MAX = 1e4;

/** Tamanho mínimo de imagem no mundo (quase zero; evita width/height === 0). */
export const IMAGE_RESIZE_MIN_WORLD = 1e-8;

export function clampViewportZoom(zoom) {
    const z = Number(zoom);
    if (!Number.isFinite(z) || z <= 0) return VIEWPORT_ZOOM_MIN;
    return Math.min(VIEWPORT_ZOOM_MAX, Math.max(VIEWPORT_ZOOM_MIN, z));
}

/** Converte px de tela para unidades no layer com transform scale(zoom). */
export function screenPxToWorld(zoom, screenPx) {
    return screenPx / clampViewportZoom(zoom);
}

/** Rótulo do zoom na barra (suporta valores muito grandes ou pequenos). */
export function formatViewportZoomPercent(zoom) {
    const pct = clampViewportZoom(zoom) * 100;
    if (!Number.isFinite(pct)) return '—';
    if (pct >= 1000) return `${Math.round(pct).toLocaleString('pt-BR')}%`;
    if (pct >= 10) return `${Math.round(pct)}%`;
    if (pct >= 0.1) return `${pct.toFixed(1)}%`;
    if (pct >= 0.001) return `${pct.toFixed(3)}%`;
    return `${pct.toExponential(1)}%`;
}
