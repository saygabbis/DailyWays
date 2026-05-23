import React from 'react';
import BaseNode from './BaseNode';

export default function ConnectorNode({ node, onNodePointerDown, onNodeContextMenu }) {
    return (
        <BaseNode node={node} onNodePointerDown={onNodePointerDown} onNodeContextMenu={onNodeContextMenu}>
            <div
                className="whiteboard-node connector-node"
                style={{
                    width: node.width,
                    height: node.height,
                    pointerEvents: 'none',
                }}
            />
        </BaseNode>
    );
}
