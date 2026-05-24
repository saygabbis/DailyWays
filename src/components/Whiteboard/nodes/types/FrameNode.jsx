import React, { memo } from 'react';
import BaseNode from './BaseNode';
import AppearanceRenderer from '../../shared/AppearanceRenderer.jsx';
import { sameNodeVisual } from '../../shared/appearanceStyle.js';

const FrameNodeVisual = memo(function FrameNodeVisual({ node }) {
    const title = node.data?.title ?? 'Frame';

    return (
        <div
            className="whiteboard-node frame-node"
            style={{
                width: node.width,
                height: node.height,
                position: 'relative',
                overflow: 'visible',
            }}
        >
            <AppearanceRenderer
                node={node}
                width={node.width}
                height={node.height}
                shapeKind="rectangle"
            />
            <div
                className="frame-title"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    padding: '8px 12px',
                    fontWeight: 600,
                    borderBottom: '1px solid var(--border-color)',
                    pointerEvents: 'none',
                }}
            >
                {title}
            </div>
        </div>
    );
}, (prev, next) => sameNodeVisual(prev.node, next.node));

export default function FrameNode({ node, onNodePointerDown, onNodeContextMenu }) {
    return (
        <BaseNode node={node} onNodePointerDown={onNodePointerDown} onNodeContextMenu={onNodeContextMenu}>
            <FrameNodeVisual node={node} />
        </BaseNode>
    );
}
