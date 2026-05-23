import React, { useRef, useCallback } from 'react';
import { useWhiteboardStore } from '../../../stores/whiteboardStore';
import { getNodeTransformStyle } from '../nodeTransform';
import { resolveNodeClickSelection } from '../whiteboardGroupOps';

export default function BaseNode({ node, children, onNodePointerDown, onNodeContextMenu }) {
    const ref = useRef(null);
    const { nodes, selectedNodeIds, setSelection, setEditingNodeId } = useWhiteboardStore();
    const isSelected = selectedNodeIds.includes(node.id);

    const handlePointerDown = useCallback(
        (e) => {
            if (e.button === 1) return;
            e.stopPropagation();
            if (e.button !== 0) return;
            const next = resolveNodeClickSelection(node.id, nodes, selectedNodeIds, {
                shiftKey: e.shiftKey,
                ctrlKey: e.ctrlKey || e.metaKey,
            });
            setSelection(next);
            onNodePointerDown?.(e, node.id);
        },
        [node.id, nodes, selectedNodeIds, setSelection, onNodePointerDown]
    );

    const handleContextMenu = useCallback(
        (e) => {
            onNodeContextMenu?.(e, node.id);
        },
        [node.id, onNodeContextMenu]
    );

    const handleDoubleClick = useCallback(
        (e) => {
            e.stopPropagation();
            if (node.type === 'text' || node.type === 'sticky_note') {
                setEditingNodeId(node.id);
            }
        },
        [node.id, node.type, setEditingNodeId]
    );

    return (
        <div
            ref={ref}
            className={`whiteboard-node-wrapper ${isSelected ? 'selected' : ''}`}
            style={{
                position: 'absolute',
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height,
            }}
            onPointerDown={handlePointerDown}
            onContextMenu={handleContextMenu}
            onDoubleClick={handleDoubleClick}
        >
            <div
                className="whiteboard-node-inner"
                style={{ width: '100%', height: '100%', ...getNodeTransformStyle(node) }}
            >
                {children}
            </div>
        </div>
    );
}
