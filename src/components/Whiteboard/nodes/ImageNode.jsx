import React from 'react';
import BaseNode from './BaseNode';
import { Download } from 'lucide-react';

export default function ImageNode({ node, onNodePointerDown }) {
    const url = node.data?.url ?? '';
    const filename = node.data?.filename ?? '';
    const size = node.data?.size ?? '';

    return (
        <BaseNode node={node} onNodePointerDown={onNodePointerDown}>
            <div
                className="whiteboard-node image-node image-node-card"
                style={{
                    width: node.width,
                    height: node.height,
                    transform: `rotate(${node.rotation ?? 0}deg)`,
                    overflow: 'hidden',
                    borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-elevated)',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <div style={{ flex: 1, minHeight: 0, background: 'var(--bg-tertiary)' }}>
                    {url ? (
                        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                            Sem imagem
                        </div>
                    )}
                </div>
                {(filename || size || url) && (
                    <div style={{ padding: '6px 8px', borderTop: '1px solid var(--border-color)', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {filename && <span>{filename}</span>}
                            {size && <span style={{ color: 'var(--text-tertiary)', marginLeft: 4 }}>{size}</span>}
                        </div>
                        {url && (
                            <a href={url} download target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0, display: 'flex', color: 'var(--accent)' }}>
                                <Download size={14} />
                            </a>
                        )}
                    </div>
                )}
            </div>
        </BaseNode>
    );
}
