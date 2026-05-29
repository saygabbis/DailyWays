import React from 'react';
import BaseNode from './BaseNode';
import { useSpaceAssetUrl } from '../../../../hooks/useSpaceAssetUrl';

export default function ImageNode({ node, onNodePointerDown, onNodeContextMenu }) {
    const url = useSpaceAssetUrl(node);

    return (
        <BaseNode node={node} onNodePointerDown={onNodePointerDown} onNodeContextMenu={onNodeContextMenu}>
            <div
                className="whiteboard-node image-node"
                style={{
                    width: node.width,
                    height: node.height,
                    overflow: 'hidden',
                    borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-tertiary)',
                    boxShadow: 'var(--shadow-sm)',
                }}
            >
                {url ? (
                    <img
                        src={url}
                        alt=""
                        draggable={false}
                        onDragStart={(e) => e.preventDefault()}
                        style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }}
                    />
                ) : (
                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-tertiary)',
                            fontSize: 12,
                        }}
                    >
                        Sem imagem
                    </div>
                )}
            </div>
        </BaseNode>
    );
}
