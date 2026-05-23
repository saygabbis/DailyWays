import React from 'react';
import BaseNode from './BaseNode';
import { Link2 } from 'lucide-react';
import { useEditableNodeField } from '../../interaction/hooks/useEditableNodeField';
import { getTextStyleFromNode, textStyleToCss } from '../../shared/textStyle';

export default function LinkCardNode({ node, onNodePointerDown, onNodeContextMenu }) {
    const url = node.data?.url ?? '';
    const title = node.data?.title ?? '';
    const displayTitle = title || url || '';
    const textStyle = getTextStyleFromNode(node);
    const css = textStyleToCss(textStyle);

    const { isEditing, editValue, setEditValue, commitBlur } = useEditableNodeField(node.id, 'title', {
        displayValue: title,
        emptySeedValue: '',
    });

    const handleBlur = () => {
        commitBlur(node, (n, value) => ({ data: { ...n.data, title: value } }));
    };

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
                        {isEditing ? (
                            <input
                                type="text"
                                className="link-card-title-edit"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={handleBlur}
                                autoFocus
                                placeholder="Título do link"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    width: '100%',
                                    marginBottom: 4,
                                    font: 'inherit',
                                    ...css,
                                }}
                            />
                        ) : (
                            <div
                                style={{
                                    fontWeight: textStyle.fontWeight,
                                    marginBottom: 4,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    ...css,
                                }}
                            >
                                {displayTitle || <span style={{ color: 'var(--text-tertiary)' }}>Título do link</span>}
                            </div>
                        )}
                        {url && !isEditing && (
                            <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    fontSize: Math.max(11, (textStyle.fontSize || 14) - 2),
                                    color: 'var(--text-tertiary)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    display: 'block',
                                }}
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
