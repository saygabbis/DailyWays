import React from 'react';
import BaseNode from './BaseNode';

export default function ShapeNode({ node, onNodePointerDown }) {
    const shape = node.data?.shape ?? 'rectangle';
    const fill = node.style?.fill ?? 'var(--bg-elevated)';
    const stroke = node.style?.stroke ?? 'var(--border-color)';
    return (
        <BaseNode node={node} onNodePointerDown={onNodePointerDown}>
            <div
                className="whiteboard-node shape-node"
                style={{
                    width: node.width,
                    height: node.height,
                    transform: `rotate(${node.rotation ?? 0}deg)`,
                    backgroundColor: fill,
                    border: `2px solid ${stroke}`,
                    borderRadius: shape === 'ellipse' ? '50%' : 4,
                }}
            />
        </BaseNode>
    );
}
