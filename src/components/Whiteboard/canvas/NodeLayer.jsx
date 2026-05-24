import React, { useMemo, memo } from 'react';
import { useWhiteboardDocumentStore } from '../../../stores/whiteboardDocumentStore';
import { useWhiteboardSelectionStore } from '../../../stores/whiteboardSelectionStore';
import { intersectsViewport, CONTAINER_NODE_TYPES } from '../interaction/viewport/viewportUtils';
import { getNodePageId } from '../core/pages/whiteboardPages';
import ResizeHandles from './overlays/ResizeHandles';
import { getTransformTargetIds } from '../interaction/transform/selectionTransform';
import { NODE_COMPONENTS } from '../nodes/registry';
import { useNodeDragTranslate, dragTranslateStyle } from '../interaction/hooks/useNodeDragTranslate';

const CanvasNode = memo(function CanvasNode({ node, onNodePointerDown, onNodeContextMenu }) {
    const Comp = NODE_COMPONENTS[node.type] ?? NODE_COMPONENTS.sticky_note;
    return (
        <Comp
            node={node}
            onNodePointerDown={onNodePointerDown}
            onNodeContextMenu={onNodeContextMenu}
        />
    );
}, (prev, next) =>
    prev.node === next.node &&
    prev.onNodePointerDown === next.onNodePointerDown &&
    prev.onNodeContextMenu === next.onNodeContextMenu);

function FrameGroupShell({ root, children, onNodePointerDown, onNodeContextMenu }) {
    const dragTranslate = useNodeDragTranslate(root.id);
    const FrameComp = NODE_COMPONENTS[root.type] ?? NODE_COMPONENTS.frame;
    const rootAtZero = { ...root, x: 0, y: 0 };

    return (
        <div
            className="whiteboard-frame-group"
            style={{
                position: 'absolute',
                left: root.x,
                top: root.y,
                width: root.width ?? 0,
                height: root.height ?? 0,
                pointerEvents: 'none',
                transform: dragTranslateStyle(dragTranslate),
            }}
        >
            <div style={{ pointerEvents: 'auto' }}>
                <FrameComp
                    node={rootAtZero}
                    onNodePointerDown={onNodePointerDown}
                    onNodeContextMenu={onNodeContextMenu}
                />
            </div>
            <div
                className="whiteboard-frame-children"
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                }}
            >
                {children}
            </div>
        </div>
    );
}

function getRoots(nodes) {
    return nodes.filter((n) => !n.parentId);
}

function getChildren(nodes, parentId) {
    return nodes.filter((n) => n.parentId === parentId).sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
}

export default function NodeLayer({ onNodePointerDown, onNodeContextMenu, onResizeStart, onRotateStart }) {
    const nodes = useWhiteboardDocumentStore((s) => s.nodes);
    const activePageId = useWhiteboardDocumentStore((s) => s.activePageId);
    const selectedNodeIds = useWhiteboardSelectionStore((s) => s.selectedNodeIds);
    const viewport = useWhiteboardSelectionStore((s) => s.viewport);
    const pageNodes = useMemo(
        () => nodes.filter((n) => getNodePageId(n) === activePageId),
        [nodes, activePageId]
    );
    const roots = useMemo(() => getRoots(pageNodes), [pageNodes]);
    const vp = useMemo(() => {
        const z = Math.max(0.1, Number(viewport?.zoom) || 1);
        const panX = Number(viewport?.panX) || 0;
        const panY = Number(viewport?.panY) || 0;
        const W = typeof window !== 'undefined' ? window.innerWidth : 1920;
        const H = typeof window !== 'undefined' ? window.innerHeight : 1080;
        const centerX = -panX / z;
        const centerY = -panY / z;
        const margin = 400 / z;
        return {
            x: centerX - W / (2 * z) - margin,
            y: centerY - H / (2 * z) - margin,
            width: W / z + margin * 2,
            height: H / z + margin * 2,
        };
    }, [viewport]);

    const visibleRoots = useMemo(() => {
        if (roots.length === 0) return [];
        if (!Number.isFinite(vp.x) || !Number.isFinite(vp.y) || vp.width <= 0 || vp.height <= 0) {
            return [...roots].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
        }
        return roots.filter((r) => {
            if (CONTAINER_NODE_TYPES.includes(r.type)) {
                const children = getChildren(nodes, r.id);
                const selfVisible = intersectsViewport(r, vp);
                const childVisible = children.some((c) =>
                    intersectsViewport({ ...c, x: r.x + c.x, y: r.y + c.y }, vp)
                );
                return selfVisible || childVisible;
            }
            return intersectsViewport(r, vp);
        }).sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    }, [pageNodes, roots, vp]);

    const transformIds = useMemo(
        () => getTransformTargetIds(selectedNodeIds, nodes),
        [selectedNodeIds, nodes]
    );
    const useUnifiedTransform = transformIds.length > 1;
    const transformIdSet = useMemo(() => new Set(transformIds), [transformIds]);

    const renderNode = (node) => (
        <CanvasNode
            key={node.id}
            node={node}
            onNodePointerDown={onNodePointerDown}
            onNodeContextMenu={onNodeContextMenu}
        />
    );

    return (
        <>
            {visibleRoots.map((root) => {
                const children = getChildren(pageNodes, root.id);
                const isContainerWithChildren =
                    CONTAINER_NODE_TYPES.includes(root.type) && children.length > 0;
                if (isContainerWithChildren) {
                    return (
                        <FrameGroupShell
                            key={root.id}
                            root={root}
                            onNodePointerDown={onNodePointerDown}
                            onNodeContextMenu={onNodeContextMenu}
                        >
                            {children.map((child) => (
                                <div
                                    key={child.id}
                                    style={{ position: 'absolute', left: child.x, top: child.y, pointerEvents: 'auto' }}
                                >
                                    {renderNode(child)}
                                </div>
                            ))}
                        </FrameGroupShell>
                    );
                }
                return renderNode(root);
            })}
            {onResizeStart &&
                !useUnifiedTransform &&
                visibleRoots
                    .filter((n) => transformIdSet.has(n.id) && n.width && n.height)
                    .map((node) => (
                        <ResizeHandles
                            key={`resize-${node.id}`}
                            node={node}
                            zoom={viewport?.zoom ?? 1}
                            onResizeStart={onResizeStart}
                            onRotateStart={onRotateStart}
                        />
                    ))}
            {onResizeStart &&
                !useUnifiedTransform &&
                visibleRoots.flatMap((root) =>
                    getChildren(pageNodes, root.id)
                        .filter((c) => transformIdSet.has(c.id) && c.width && c.height)
                        .map((child) => (
                            <ResizeHandles
                                key={`resize-${child.id}`}
                                node={child}
                                zoom={viewport?.zoom ?? 1}
                                onResizeStart={onResizeStart}
                                onRotateStart={onRotateStart}
                                offset={{ x: root.x, y: root.y }}
                            />
                        ))
                )}
        </>
    );
}
