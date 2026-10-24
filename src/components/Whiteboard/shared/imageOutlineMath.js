import { screenPxToWorld } from '../interaction/viewport/viewportLimits.js';
import { effectiveStrokeScreenPx } from './vectorViewport.js';

/**
 * Raio do feMorphology em unidades do viewBox (userSpaceOnUse).
 * Espessura visual em px de ecrã = stroke.width (após clamp), independente do zoom do canvas.
 */
export function getMorphologyRadius(stroke, zoom) {
    const effectiveScreen = effectiveStrokeScreenPx(stroke);
    if (effectiveScreen <= 0) return 0;
    const worldTh = screenPxToWorld(zoom, effectiveScreen);
    const align = stroke.align ?? 'outside';
    if (align === 'center') return worldTh * 0.5;
    if (align === 'inside') return worldTh;
    return worldTh;
}
