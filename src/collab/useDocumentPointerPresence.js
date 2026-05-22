import { useEffect } from 'react';
import { pointerCoordsFromEvent } from './pointerViewport.js';

/**
 * Atualiza presença/cursor em overlays (modal, backdrop, portais) onde pointermove no painel falha.
 */
export function useDocumentPointerPresence({
  enabled,
  updateCursor,
  selectedCardId = null,
  onPointerMove,
  getCoords,
}) {
  useEffect(() => {
    if (!enabled || !updateCursor) return undefined;

    const onMove = (e) => {
      const coords = getCoords ? getCoords(e) : pointerCoordsFromEvent(e);
      updateCursor({
        ...coords,
        ...(selectedCardId != null ? { selectedCardId } : {}),
      });
      onPointerMove?.(e, coords);
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    return () => document.removeEventListener('pointermove', onMove);
  }, [enabled, updateCursor, selectedCardId, onPointerMove, getCoords]);
}
