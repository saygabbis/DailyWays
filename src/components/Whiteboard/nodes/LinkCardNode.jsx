import React from 'react';
import BaseNode from './BaseNode';
import { Link2 } from 'lucide-react';

export default function LinkCardNode({ node, onNodePointerDown, onNodeContextMenu }) {
    const url = node.data?.url ?? '';
    const title = node.data?.title ?? (url || 'Link');
    return (
        <BaseNode node={node} onNodePointerDown={onNodePointerDown} onNodeContextMenu={onNodeContextMenu}>
            <div
                className="whiteboard-node link-card-node"
                style={{
                    width: node.width,
                    height: node.height,
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    backgroundColor: 'var(--bg-elevated)',
                    boxShadow: 'var(--shadow-sm)',
                    padding: 12,
                    overflow: 'hidden',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <Link2 size={20} style={{ flexShrink: 0, color: 'var(--accent)' }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {title}
                        </div>
                        {url && (
                            <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{ fontSize: 12, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}
                            >
                                {url}
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </BaseNode>
    );
}
