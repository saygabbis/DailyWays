import React, { useMemo } from 'react';
import { useWhiteboardStore } from '../../stores/whiteboardStore';
import { intersectsViewport, CONTAINER_NODE_TYPES } from './viewportUtils';
import ResizeHandles from './ResizeHandles';
import StickyNoteNode from './nodes/StickyNoteNode';
import TextNode from './nodes/TextNode';
import ShapeNode from './nodes/ShapeNode';
import FrameNode from './nodes/FrameNode';
import ImageNode from './nodes/ImageNode';
import ConnectorNode from './nodes/ConnectorNode';
import CommentNode from './nodes/CommentNode';
import LinkCardNode from './nodes/LinkCardNode';
import TodoListNode from './nodes/TodoListNode';
import FileCardNode from './nodes/FileCardNode';
import DrawingNode from './nodes/DrawingNode';
import ColumnNode from './nodes/ColumnNode';
import TableNode from './nodes/TableNode';

const NODE_COMPONENTS = {
    sticky_note: StickyNoteNode,
    text: TextNode,
    shape: ShapeNode,
    frame: FrameNode,
    image: ImageNode,
    connector: ConnectorNode,
    comment: CommentNode,
    link: LinkCardNode,
    todo_list: TodoListNode,
    file_card: FileCardNode,
    drawing: DrawingNode,
    column: ColumnNode,
    table: TableNode,
};

function getRoots(nodes) {
    return nodes.filter((n) => !n.parentId);
}

function getChildren(nodes, parentId) {
    return nodes.filter((n) => n.parentId === parentId).sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
}

export default function NodeLayer({ onNodePointerDown, onResizeStart }) {
    const { nodes, viewport, selectedNodeIds } = useWhiteboardStore();
    const roots = useMemo(() => getRoots(nodes), [nodes]);
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
    }, [nodes, roots, vp]);

    const selectedSet = useMemo(() => new Set(selectedNodeIds || []), [selectedNodeIds]);

    const renderNode = (node, isInGroup = false) => {
        const Comp = NODE_COMPONENTS[node.type] || StickyNoteNode;
        return <Comp key={node.id} node={node} onNodePointerDown={onNodePointerDown} />;
    };

    return (
        <>
            {visibleRoots.map((root) => {
                const children = getChildren(nodes, root.id);
                const isContainerWithChildren =
                    CONTAINER_NODE_TYPES.includes(root.type) && children.length > 0;
                if (isContainerWithChildren) {
                    const FrameComp = NODE_COMPONENTS[root.type] || FrameNode;
                    const rootAtZero = { ...root, x: 0, y: 0 };
                    return (
                        <div
                            key={root.id}
                            className="whiteboard-frame-group"
                            style={{
                                position: 'absolute',
                                left: root.x,
                                top: root.y,
                                width: root.width ?? 0,
                                height: root.height ?? 0,
                                pointerEvents: 'none',
                            }}
                        >
                            <div style={{ pointerEvents: 'auto' }}>
                                <FrameComp node={rootAtZero} onNodePointerDown={onNodePointerDown} />
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
                                {children.map((child) => (
                                    <div key={child.id} style={{ position: 'absolute', left: child.x, top: child.y, pointerEvents: 'auto' }}>
                                        {renderNode(child, true)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                }
                return renderNode(root);
            })}
            {onResizeStart &&
                visibleRoots.filter((n) => selectedSet.has(n.id) && n.width && n.height).map((node) => (
                    <ResizeHandles key={`resize-${node.id}`} node={node} onResizeStart={onResizeStart} />
                ))}
            {visibleRoots.flatMap((root) =>
                getChildren(nodes, root.id).filter((c) => selectedSet.has(c.id) && c.width && c.height).map((child) => (
                    <ResizeHandles
                        key={`resize-${child.id}`}
                        node={child}
                        onResizeStart={onResizeStart}
                        offset={{ x: root.x, y: root.y }}
                    />
                ))
            )}
        </>
    );
}
