import React from 'react';
import BaseNode from './BaseNode';

export default function DrawingNode({ node, onNodePointerDown }) {
    const paths = node.data?.paths ?? [];
    const stroke = node.style?.stroke ?? '#000';

    return (
        <BaseNode node={node} onNodePointerDown={onNodePointerDown}>
            <div
                className="whiteboard-node drawing-node"
                style={{
                    width: node.width,
                    height: node.height,
                    transform: `rotate(${node.rotation ?? 0}deg)`,
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    backgroundColor: 'var(--bg-elevated)',
                    overflow: 'hidden',
                }}
            >
                <svg width="100%" height="100%" style={{ display: 'block' }}>
                    {paths.length > 0 ? (
                        paths.map((path, i) => (
                            <path
                                key={i}
                                d={path.d ?? ''}
                                fill="none"
                                stroke={path.stroke ?? stroke}
                                strokeWidth={path.strokeWidth ?? 2}
                            />
                        ))
                    ) : (
                        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill="var(--text-tertiary)" fontSize={12}>
                            Desenho
                        </text>
                    )}
                </svg>
            </div>
        </BaseNode>
    );
}
