import { useMemo, memo, useState, useLayoutEffect } from 'react';
import { useWhiteboardDocumentStore } from '../../../stores/whiteboardDocumentStore';
import { useWhiteboardSelectionStore } from '../../../stores/whiteboardSelectionStore';
import {
    intersectsViewport,
    CONTAINER_NODE_TYPES,
    computeWorldViewportBounds,
} from '../interaction/viewport/viewportUtils';
import { getNodePageId } from '../core/pages/whiteboardPages';
import { NODE_COMPONENTS } from '../nodes/registry';
import { useNodeDragTranslate, dragTranslateStyle } from '../interaction/hooks/useNodeDragTranslate';
import { usePageSpaceAssetPrefetch } from '../../../hooks/usePageSpaceAssetPrefetch';

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
    const clipContent = root?.data?.clipContent !== false;

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
            <div style={{ pointerEvents: 'none', position: 'relative', zIndex: 0 }}>
                <FrameComp
                    node={rootAtZero}
                    disableDragPreview
                    embedded
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
                    overflow: clipContent ? 'hidden' : 'visible',
                    pointerEvents: 'none',
                    zIndex: 1,
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

function useContainerSize(containerRef) {
    const [size, setSize] = useState({ width: 0, height: 0 });

    useLayoutEffect(() => {
        const el = containerRef?.current;
        if (!el) return undefined;

        const update = () => {
            const rect = el.getBoundingClientRect();
            setSize({
                width: Math.max(1, Math.round(rect.width)),
                height: Math.max(1, Math.round(rect.height)),
            });
        };

        update();
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
        ro?.observe(el);
        window.addEventListener('resize', update);
        return () => {
            ro?.disconnect();
            window.removeEventListener('resize', update);
        };
    }, [containerRef]);

    return size;
}

function getRootId(byId, nodeId) {
    let n = byId.get(nodeId);
    while (n?.parentId) n = byId.get(n.parentId);
    return n?.id ?? null;
}

export default function NodeLayer({ onNodePointerDown, onNodeContextMenu, viewport, containerRef }) {
    const nodes = useWhiteboardDocumentStore((s) => s.nodes);
    const activePageId = useWhiteboardDocumentStore((s) => s.activePageId);
    const selectedNodeIds = useWhiteboardSelectionStore((s) => s.selectedNodeIds);
    const storeViewport = useWhiteboardSelectionStore((s) => s.viewport);
    const liveViewport = viewport ?? storeViewport;
    const containerSize = useContainerSize(containerRef);

    const pageNodes = useMemo(
        () => nodes.filter((n) => getNodePageId(n) === activePageId),
        [nodes, activePageId]
    );
    const roots = useMemo(() => getRoots(pageNodes), [pageNodes]);
    usePageSpaceAssetPrefetch(pageNodes);

    const forcedRootIds = useMemo(() => {
        const byId = new Map(pageNodes.map((n) => [n.id, n]));
        const ids = new Set();
        for (const id of selectedNodeIds ?? []) {
            const rootId = getRootId(byId, id);
            if (rootId) ids.add(rootId);
        }
        return ids;
    }, [pageNodes, selectedNodeIds]);

    const vp = useMemo(() => {
        const W = containerSize.width || (typeof window !== 'undefined' ? window.innerWidth : 1920);
        const H = containerSize.height || (typeof window !== 'undefined' ? window.innerHeight : 1080);
        return computeWorldViewportBounds(liveViewport, W, H, 1200);
    }, [liveViewport, containerSize.width, containerSize.height]);

    const visibleRoots = useMemo(() => {
        if (roots.length === 0) return [];
        if (!Number.isFinite(vp.x) || !Number.isFinite(vp.y) || vp.width <= 0 || vp.height <= 0) {
            return [...roots].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
        }

        const selected = new Set(selectedNodeIds ?? []);
        const filtered = roots.filter((r) => {
            if (selected.has(r.id) || forcedRootIds.has(r.id)) return true;
            if (CONTAINER_NODE_TYPES.includes(r.type)) {
                const children = getChildren(pageNodes, r.id);
                const selfVisible = intersectsViewport(r, vp);
                const childVisible = children.some((c) =>
                    intersectsViewport({ ...c, x: r.x + c.x, y: r.y + c.y }, vp)
                );
                return selfVisible || childVisible;
            }
            return intersectsViewport(r, vp);
        }).sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

        return filtered;
    }, [roots, vp, pageNodes, selectedNodeIds, forcedRootIds, liveViewport, viewport, containerSize]);

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
                const useContainerShell =
                    root.type === 'frame' ||
                    (CONTAINER_NODE_TYPES.includes(root.type) && root.type !== 'frame' && children.length > 0);
                if (useContainerShell) {
                    return (
                        <FrameGroupShell
                            key={root.id}
                            root={root}
                            onNodePointerDown={onNodePointerDown}
                            onNodeContextMenu={onNodeContextMenu}
                        >
                            {children.map((child) => renderNode(child))}
                        </FrameGroupShell>
                    );
                }
                return renderNode(root);
            })}
        </>
    );
}
