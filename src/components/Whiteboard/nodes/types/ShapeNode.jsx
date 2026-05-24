import React, { memo } from 'react';
import BaseNode from './BaseNode';
import AppearanceRenderer from '../../shared/AppearanceRenderer.jsx';
import { sameNodeVisual } from '../../shared/appearanceStyle.js';

const ShapeNodeVisual = memo(function ShapeNodeVisual({ node }) {
    const shape = node.data?.shape ?? 'rectangle';
    const polygonSides = node.data?.polygonSides ?? 6;
    const shapeKind = shape === 'ellipse' ? 'ellipse' : shape === 'polygon' ? 'polygon' : 'rectangle';

    return (
        <div
            className="whiteboard-node shape-node"
            style={{ width: node.width, height: node.height, overflow: 'visible' }}
        >
            <AppearanceRenderer
                node={node}
                width={node.width}
                height={node.height}
                shapeKind={shapeKind}
                polygonSides={polygonSides}
            />
        </div>
    );
}, (prev, next) => sameNodeVisual(prev.node, next.node));

export default function ShapeNode({ node, onNodePointerDown, onNodeContextMenu }) {
    return (
        <BaseNode node={node} onNodePointerDown={onNodePointerDown} onNodeContextMenu={onNodeContextMenu}>
            <ShapeNodeVisual node={node} />
        </BaseNode>
    );
}
