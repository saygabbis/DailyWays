import React, { useMemo } from 'react';
import { useWhiteboardStore } from '../../../../stores/whiteboardStore';
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

    const transformIds = useMemo(
        () => getTransformTargetIds(selectedNodeIds, nodes),
        [selectedNodeIds, nodes]
    );

    const useUnified = shouldUseUnifiedTransform(selectedNodeIds, nodes);
    const pseudoNode = useMemo(
        () => (useUnified ? buildPseudoNodeForSelection(nodes, transformIds) : null),
        [useUnified, nodes, transformIds]
    );

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
