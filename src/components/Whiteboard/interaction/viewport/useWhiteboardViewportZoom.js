import { createContext, useContext } from 'react';
import { useWhiteboardSelectionStore } from '../../../../stores/whiteboardSelectionStore';
import { clampViewportZoom } from './viewportLimits.js';
import { getRenderZoom } from '../../shared/vectorViewport.js';

export const WhiteboardViewportContext = createContext({ zoom: 1 });

/**
 * Zoom do canvas em tempo real (provider + store de seleção).
 * Necessário para bordas/contornos em px de ecrã fixos com zoom infinito.
 */
export function useWhiteboardViewportZoom() {
    const contextZoom = useContext(WhiteboardViewportContext).zoom;
    const storeZoom = useWhiteboardSelectionStore((s) => s.viewport?.zoom ?? 1);
    const z = contextZoom > 0 ? contextZoom : storeZoom;
    return clampViewportZoom(z);
}

/** Fator mundo → px do layout interno do VectorViewportShell (tipografia/padding dos filhos). */
export function useSharpRenderZoom() {
    return getRenderZoom(useWhiteboardViewportZoom());
}
