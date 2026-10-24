import React, { useMemo } from 'react';
import { useWhiteboardDocumentStore } from '../../../../stores/whiteboardDocumentStore';
import { useWhiteboardStore } from '../../../../stores/whiteboardStore';
import { getNodePageId } from '../../core/pages/whiteboardPages';
import { nodeToWorld } from '../../core/nodeGeometry';
import { buildNodesById } from '../../core/ops/whiteboardNodeOps';
import {
    buildPseudoNodeForSelection,
    getTransformTargetIds,
    shouldUseUnifiedTransform,
} from '../../interaction/transform/selectionTransform';
import ResizeHandles from './ResizeHandles';

/**
 * Handles de resize/rotação em pixels de ecrã (fora do scale do canvas).
 */
export default function TransformHandlesLayer({ viewport, containerRef, onResizeStart, onRotateStart }) {
    const nodes = useWhiteboardDocumentStore((s) => s.nodes);
    const activePageId = useWhiteboardDocumentStore((s) => s.activePageId);
    const { selectedNodeIds, groupDrill, isolateSelection } = useWhiteboardStore();

    const selectionContext = useMemo(
        () => ({ groupDrill, isolateSelection }),
        [groupDrill, isolateSelection]
    );

    const nodesById = useMemo(() => buildNodesById(nodes), [nodes]);

    const transformIds = useMemo(
        () => getTransformTargetIds(selectedNodeIds, nodes, selectionContext),
        [selectedNodeIds, nodes, selectionContext]
    );

    const useUnified = shouldUseUnifiedTransform(selectedNodeIds, nodes, selectionContext);

    const pseudoNode = useMemo(() => {
        if (!useUnified) return null;
        return buildPseudoNodeForSelection(nodes, transformIds);
    }, [useUnified, nodes, transformIds]);

    const perNodeHandles = useMemo(() => {
        if (useUnified || !transformIds.length) return [];
        const pageNodeIds = new Set(
            nodes.filter((n) => getNodePageId(n) === activePageId).map((n) => n.id)
        );
        return transformIds
            .filter((id) => pageNodeIds.has(id))
            .map((id) => {
                const node = nodesById.get(id);
                if (!node?.width || !node?.height) return null;
                const world = nodeToWorld(node, nodesById);
                return { ...node, x: world.x, y: world.y };
            })
            .filter(Boolean);
    }, [useUnified, transformIds, nodes, nodesById, activePageId]);

    if (!onResizeStart || !viewport || !containerRef) return null;

    if (useUnified && pseudoNode) {
        return (
            <ResizeHandles
                node={pseudoNode}
                viewport={viewport}
                containerRef={containerRef}
                onResizeStart={onResizeStart}
                onRotateStart={onRotateStart}
                unified
            />
        );
    }

    return (
        <>
            {perNodeHandles.map((node) => (
                <ResizeHandles
                    key={`resize-screen-${node.id}`}
                    node={node}
                    viewport={viewport}
                    containerRef={containerRef}
                    onResizeStart={onResizeStart}
                    onRotateStart={onRotateStart}
                />
            ))}
        </>
    );
}
