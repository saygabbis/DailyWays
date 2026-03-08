import React from 'react';
import BaseNode from './BaseNode';

export default function FrameNode({ node, onNodePointerDown }) {
    const title = node.data?.title ?? 'Frame';
    return (
        <BaseNode node={node} onNodePointerDown={onNodePointerDown}>
            <div
                className="whiteboard-node frame-node"
                style={{
                    width: node.width,
                    height: node.height,
                    transform: `rotate(${node.rotation ?? 0}deg)`,
                    border: '2px dashed var(--border-color)',
                    borderRadius: 8,
                    backgroundColor: 'var(--bg-elevated)',
                    opacity: 0.6,
                }}
            >
                <div className="frame-title" style={{ padding: '8px 12px', fontWeight: 600, borderBottom: '1px solid var(--border-color)' }}>
                    {title}
                </div>
            </div>
        </BaseNode>
    );
}
