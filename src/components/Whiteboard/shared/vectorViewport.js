import { clampViewportZoom, screenPxToWorld } from '../interaction/viewport/viewportLimits.js';

/** Zoom usado só para rasterizar SVG/texto nítido (evita layout 1e10 px). */
const RENDER_ZOOM_MIN = 1 / 512;
const RENDER_ZOOM_MAX = 512;

/** Dimensão mínima em mundo — abaixo disto o browser perde subpixel. */
export const WORLD_DIM_EPSILON = 1e-9;

export function getRenderZoom(zoom) {
    const z = clampViewportZoom(zoom);
    return Math.min(RENDER_ZOOM_MAX, Math.max(RENDER_ZOOM_MIN, z));
}

/** Largura de stroke no modelo = pixels de ecrã (constantes ao mudar zoom). */
export function strokeWidthInWorld(zoom, screenStrokePx) {
    return screenPxToWorld(zoom, screenStrokePx);
}

/** stroke.width no inspector = px de ecrã fixos (sem clamp dependente do zoom). */
export function effectiveStrokeScreenPx(stroke) {
    return Math.max(0, Number(stroke?.width) || 0);
}

/**
 * Escala de 1 unidade do viewBox SVG → px de ecrã (AppearanceRenderer com layout sharp).
 * layoutW = viewW * renderZ, CSS scale(1/renderZ), canvas scale(zoom).
 */
function viewBoxUnitToScreenScale(zoom, viewBoxWidth) {
    const z = clampViewportZoom(zoom);
    const renderZ = getRenderZoom(zoom);
    const vbW = Math.max(Number(viewBoxWidth) || 0, WORLD_DIM_EPSILON);
    const viewW = vbW;
    const layoutW = viewW * renderZ;
    return (layoutW / vbW) * (1 / renderZ) * z;
}

/** Espessura em unidades do viewBox para parecer `screenPx` no ecrã. */
export function strokeWidthInViewBoxUnits(zoom, screenPx, viewBoxWidth) {
    const s = Math.max(0, Number(screenPx) || 0);
    if (s <= 0) return 0;
    const scale = viewBoxUnitToScreenScale(zoom, viewBoxWidth);
    if (scale <= 0) return 0;
    return s / scale;
}

export function strokeWidthInWorldForNode(zoom, stroke) {
    const screenPx = effectiveStrokeScreenPx(stroke);
    if (screenPx <= 0) return 0;
    return strokeWidthInWorld(zoom, screenPx);
}

function safeWorldDim(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return WORLD_DIM_EPSILON;
    return Math.max(n, WORLD_DIM_EPSILON);
}

/**
 * SVG nítido dentro do canvas com scale(zoom).
 * Usa renderZ (limitado) para layout interno; footprint visual continua width×height mundo.
 */
export function getSharpSvgLayout(width, height, zoom) {
    const z = clampViewportZoom(zoom);
    const renderZ = getRenderZoom(zoom);
    const w = safeWorldDim(width);
    const h = safeWorldDim(height);
    const layout = {
        z,
        renderZ,
        layoutWidth: w * renderZ,
        layoutHeight: h * renderZ,
        displayWidth: w,
        displayHeight: h,
        scaleTransform: `scale(${1 / renderZ})`,
    };
    return layout;
}
