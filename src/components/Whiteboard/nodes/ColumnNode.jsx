import React from 'react';
import BaseNode from './BaseNode';

export default function ColumnNode({ node, onNodePointerDown }) {
    const title = node.data?.title ?? 'Coluna';
    return (
        <BaseNode node={node} onNodePointerDown={onNodePointerDown}>
            <div
                className="whiteboard-node column-node"
                style={{
                    width: node.width,
                    height: node.height,
                    transform: `rotate(${node.rotation ?? 0}deg)`,
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    backgroundColor: 'var(--bg-elevated)',
                    padding: 10,
                }}
            >
                <div style={{ fontWeight: 600, marginBottom: 8 }}>{title}</div>
            </div>
        </BaseNode>
    );
}
