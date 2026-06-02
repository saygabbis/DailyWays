import { getDefaultNodePayload } from '../../core/nodeDefaults.js';
import { clampViewportZoom } from './viewportLimits.js';

/** Tamanho mínimo visível ao arrastar criar (pixels de tela → mundo). */
export const MIN_CREATE_SCREEN_PX = 32;

/**
 * Dimensões padrão de criação em coordenadas mundo para o zoom atual.
 * No zoom 1 coincide com nodeDefaults; ao afastar/ampliar mantém o mesmo tamanho na tela (PureRef).
 */
export function getZoomAwareCreateDims(typeKey, zoom) {
    const z = clampViewportZoom(zoom);
    const key =
        typeKey === 'drawing' ? 'draw' : typeKey === 'file_card' ? 'file' : typeKey;
    const sample = getDefaultNodePayload(key, 0, 0);
    return {
        width: (sample.width ?? 100) / z,
        height: (sample.height ?? 100) / z,
    };
}

export function getZoomAwareMinCreateSize(zoom) {
    return MIN_CREATE_SCREEN_PX / clampViewportZoom(zoom);
}

/** Centro do clique → canto superior-esquerdo, proporcional ao zoom. */
export function getZoomAwareCreateOffset(typeKey, zoom) {
    const { width, height } = getZoomAwareCreateDims(typeKey, zoom);
    return [width / 2, height / 2];
}
