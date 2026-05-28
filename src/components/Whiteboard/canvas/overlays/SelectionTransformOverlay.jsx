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
    const { nodes, selectedNodeIds, groupDrill, isolateSelection } = useWhiteboardStore();
    const selectionContext = useMemo(
        () => ({ groupDrill, isolateSelection }),
        [groupDrill, isolateSelection]
    );

    const transformIds = useMemo(
        () => getTransformTargetIds(selectedNodeIds, nodes, selectionContext),
        [selectedNodeIds, nodes, selectionContext]
    );

    const useUnified = shouldUseUnifiedTransform(selectedNodeIds, nodes, selectionContext);
    const pseudoNode = useMemo(() => {
        if (!useUnified) return null;
        return buildPseudoNodeForSelection(nodes, transformIds);
    }, [useUnified, nodes, transformIds]);

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
