import React from 'react';
import BaseNode from './BaseNode';

export default function ColumnNode({ node, onNodePointerDown, onNodeContextMenu }) {
    const title = node.data?.title ?? 'Coluna';
    return (
        <BaseNode node={node} onNodePointerDown={onNodePointerDown} onNodeContextMenu={onNodeContextMenu}>
            <div
                className="whiteboard-node column-node"
                style={{
                    width: node.width,
                    height: node.height,
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
