import React from 'react';
import BaseNode from './BaseNode';

export default function ShapeNode({ node, onNodePointerDown, onNodeContextMenu }) {
    const shape = node.data?.shape ?? 'rectangle';
    const fill = node.style?.fill ?? 'var(--bg-elevated)';
    const stroke = node.style?.stroke ?? 'var(--border-color)';
    return (
        <BaseNode node={node} onNodePointerDown={onNodePointerDown} onNodeContextMenu={onNodeContextMenu}>
            <div
                className="whiteboard-node shape-node"
                style={{
                    width: node.width,
                    height: node.height,
                    backgroundColor: fill,
                    border: `2px solid ${stroke}`,
                    borderRadius: shape === 'ellipse' ? '50%' : 4,
                }}
            />
        </BaseNode>
    );
}
