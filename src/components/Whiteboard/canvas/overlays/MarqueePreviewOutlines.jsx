import { useMemo } from 'react';
import { useWhiteboardDocumentStore } from '../../../../stores/whiteboardDocumentStore';
import { resolveMarqueeSelectionIds } from '../../core/selection/whiteboardSelectionUtils';
import { buildNodesById } from '../../core/ops/whiteboardNodeOps';
import { nodeToWorld } from '../../core/nodeGeometry';
import { screenToWorldWithContainer, worldToScreenWithContainer } from '../../interaction/viewport/viewportUtils';
import { clampViewportZoom } from '../../interaction/viewport/viewportLimits';
import { WORLD_DIM_EPSILON } from '../../shared/vectorViewport';

const OUTLINE_BORDER_PX = 2;

function marqueeWorldBox(selectionBox, rect, viewport) {
    const w1 = screenToWorldWithContainer(selectionBox.start.x, selectionBox.start.y, rect, viewport);
    const w2 = screenToWorldWithContainer(selectionBox.current.x, selectionBox.current.y, rect, viewport);
    return {
        x: Math.min(w1.x, w2.x),
        y: Math.min(w1.y, w2.y),
        width: Math.abs(w2.x - w1.x),
        height: Math.abs(w2.y - w1.y),
    };
}

function PreviewOutline({ screenBox }) {
    if (!screenBox) return null;
    const rot = screenBox.rotation;
    return (
        <div
            className="whiteboard-marquee-preview-outline"
            style={{
                position: 'absolute',
                left: screenBox.left,
                top: screenBox.top,
                width: screenBox.width,
                height: screenBox.height,
                transform: `translate(-50%, -50%)${rot ? ` rotate(${rot}deg)` : ''}`,
                transformOrigin: 'center center',
                pointerEvents: 'none',
                boxSizing: 'border-box',
                border: `${OUTLINE_BORDER_PX}px solid var(--accent, #4d96ff)`,
                borderRadius: 2,
                boxShadow: '0 0 0 1px color-mix(in srgb, var(--accent, #4d96ff) 25%, transparent)',
            }}
            aria-hidden
        />
    );
}

/**
 * Contornos de seleção em tempo real enquanto o utilizador arrasta a caixa de marquee.
 */
export default function MarqueePreviewOutlines({ selectionBox, viewport, containerRef }) {
    const nodes = useWhiteboardDocumentStore((s) => s.nodes);
    const activePageId = useWhiteboardDocumentStore((s) => s.activePageId);
    const rect = containerRef?.current?.getBoundingClientRect?.() ?? null;
    const zoom = clampViewportZoom(viewport?.zoom ?? 1);

    const screenBoxes = useMemo(() => {
        if (!selectionBox || !rect || !viewport) return [];
        const box = marqueeWorldBox(selectionBox, rect, viewport);
        if (box.width < 2 && box.height < 2) return [];

        const ids = resolveMarqueeSelectionIds(nodes, box, activePageId);
        if (!ids.length) return [];

        const byId = buildNodesById(nodes);
        return ids
            .map((id) => {
                const node = byId.get(id);
                if (!node) return null;
                const w = Math.max(node.width ?? 0, WORLD_DIM_EPSILON);
                const h = Math.max(node.height ?? 0, WORLD_DIM_EPSILON);
                const world = nodeToWorld(node, byId);
                const center = worldToScreenWithContainer(
                    world.x + w / 2,
                    world.y + h / 2,
                    rect,
                    viewport
                );
                return {
                    id,
                    left: center.x - rect.left,
                    top: center.y - rect.top,
                    width: w * zoom,
                    height: h * zoom,
                    rotation: node.rotation ?? 0,
                };
            })
            .filter(Boolean);
    }, [selectionBox, nodes, activePageId, rect, viewport, zoom]);

    if (!screenBoxes.length) return null;

    return (
        <>
            {screenBoxes.map((screenBox) => (
                <PreviewOutline key={screenBox.id} screenBox={screenBox} />
            ))}
        </>
    );
}
