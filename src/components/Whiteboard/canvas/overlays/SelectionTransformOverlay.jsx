import React, { useMemo } from 'react';
import { useWhiteboardStore } from '../../../../stores/whiteboardStore';
import { useWhiteboardSelectionStore } from '../../../../stores/whiteboardSelectionStore';
import ResizeHandles from './ResizeHandles';
import {
    buildPseudoNodeForSelection,
    getTransformTargetIds,
    shouldUseUnifiedTransform,
} from '../../interaction/transform/selectionTransform';

/**
 * Handles unificados de resize/rotação (multi-seleção e grupos).
 * Renderizado acima dos nós, fora do fluxo que bloqueia pointer-events.
 */
export default function SelectionTransformOverlay({ viewport, onResizeStart, onRotateStart }) {
    const { nodes, selectedNodeIds } = useWhiteboardStore();
    const dragPreview = useWhiteboardSelectionStore((s) => s.nodeDragPreview);

    const transformIds = useMemo(
        () => getTransformTargetIds(selectedNodeIds, nodes),
        [selectedNodeIds, nodes]
    );

    const useUnified = shouldUseUnifiedTransform(selectedNodeIds, nodes);
    const pseudoNode = useMemo(() => {
        if (!useUnified) return null;
        const base = buildPseudoNodeForSelection(nodes, transformIds);
        if (!base || !dragPreview?.ids?.length) return base;
        const allDragged = transformIds.every((id) => dragPreview.ids.includes(id));
        if (!allDragged) return base;
        return {
            ...base,
            x: base.x + dragPreview.dx,
            y: base.y + dragPreview.dy,
        };
    }, [useUnified, nodes, transformIds, dragPreview]);

    if (!onResizeStart || !useUnified || !pseudoNode) return null;

    return (
        <div className="whiteboard-transform-overlay" aria-hidden={false}>
            <ResizeHandles
                node={pseudoNode}
                zoom={viewport?.zoom ?? 1}
                onResizeStart={onResizeStart}
                onRotateStart={onRotateStart}
                unified
            />
        </div>
    );
}
