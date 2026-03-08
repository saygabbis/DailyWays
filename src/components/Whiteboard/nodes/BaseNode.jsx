import React, { useRef, useCallback } from 'react';
import { useWhiteboardStore } from '../../../stores/whiteboardStore';

export default function BaseNode({ node, children, onNodePointerDown }) {
    const ref = useRef(null);
    const { selectedNodeIds, setSelection, lastCreatedNodeId } = useWhiteboardStore();
    const isSelected = selectedNodeIds.includes(node.id);
    const isJustCreated = lastCreatedNodeId === node.id;

    const handlePointerDown = useCallback(
        (e) => {
            e.stopPropagation();
            if (e.button !== 0) return;
            if (e.shiftKey) {
                setSelection(
                    isSelected ? selectedNodeIds.filter((id) => id !== node.id) : [...selectedNodeIds, node.id]
                );
            } else {
                setSelection(isSelected ? selectedNodeIds : [node.id]);
            }
            onNodePointerDown?.(e, node.id);
        },
        [node.id, isSelected, selectedNodeIds, setSelection, onNodePointerDown]
    );

    return (
        <div
            ref={ref}
            className={`whiteboard-node-wrapper ${isSelected ? 'selected' : ''} ${isJustCreated ? 'node-just-created' : ''}`}
            style={{
                position: 'absolute',
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height,
            }}
            onPointerDown={handlePointerDown}
        >
            {children}
        </div>
    );
}
