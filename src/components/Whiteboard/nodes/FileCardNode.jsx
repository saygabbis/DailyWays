import React from 'react';
import BaseNode from './BaseNode';
import { FileText, Download } from 'lucide-react';

export default function FileCardNode({ node, onNodePointerDown }) {
    const url = node.data?.url ?? '';
    const filename = node.data?.filename ?? 'Arquivo';
    const size = node.data?.size ?? '';

    return (
        <BaseNode node={node} onNodePointerDown={onNodePointerDown}>
            <div
                className="whiteboard-node file-card-node"
                style={{
                    width: node.width,
                    height: node.height,
                    transform: `rotate(${node.rotation ?? 0}deg)`,
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    backgroundColor: 'var(--bg-elevated)',
                    boxShadow: 'var(--shadow-sm)',
                    padding: 12,
                    overflow: 'hidden',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={22} style={{ color: 'var(--text-secondary)' }} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {filename}
                        </div>
                        {size && (
                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                                {size}
                            </div>
                        )}
                        {url && (
                            <a
                                href={url}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--accent)' }}
                            >
                                <Download size={14} />
                                Baixar
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </BaseNode>
    );
}
