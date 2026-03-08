import React from 'react';
import BaseNode from './BaseNode';

export default function ConnectorNode({ node, onNodePointerDown }) {
    return (
        <BaseNode node={node} onNodePointerDown={onNodePointerDown}>
            <div
                className="whiteboard-node connector-node"
                style={{
                    width: node.width,
                    height: node.height,
                    transform: `rotate(${node.rotation ?? 0}deg)`,
                    pointerEvents: 'none',
                }}
            />
        </BaseNode>
    );
}
