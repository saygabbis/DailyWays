import { useWhiteboardSelectionStore } from '../../../../stores/whiteboardSelectionStore';

/**
 * Preview de arraste partilhado do store (referência estável até setNodeDragPreview).
 * Retorna null se este nó não está a ser arrastado.
 */
export function useNodeDragTranslate(nodeId) {
    return useWhiteboardSelectionStore((s) => {
        const preview = s.nodeDragPreview;
        if (!preview?.ids?.includes(nodeId)) return null;
        return preview;
    });
}

export function dragTranslateStyle(preview) {
    if (!preview) return undefined;
    return `translate(${preview.dx}px, ${preview.dy}px)`;
}
