import React, { memo } from 'react';
import BaseNode from './BaseNode';
import AppearanceRenderer from '../../shared/AppearanceRenderer.jsx';
import { sameNodeVisual } from '../../shared/appearanceStyle.js';
import { useWhiteboardStore } from '../../../../stores/whiteboardStore';
import { useEditableNodeField } from '../../interaction/hooks/useEditableNodeField';

const FrameNodeVisual = memo(function FrameNodeVisual({ node }) {
    const title = node.data?.title ?? 'Frame';
    const clipEnabled = node.data?.clipContent !== false;
    const { setEditingNodeId, setEditTypingSeed } = useWhiteboardStore();
    const { isEditing, editValue, setEditValue, commitBlur } = useEditableNodeField(node.id, 'title', {
        displayValue: title,
        emptySeedValue: 'Frame',
    });

    const startEditingTitle = (e) => {
        e.stopPropagation();
        setEditingNodeId(node.id);
        setEditTypingSeed(null);
    };

    const commitTitle = () => {
        commitBlur(node, (prevNode, value) => {
            const normalized = (value ?? '').trim();
            return {
                data: {
                    ...(prevNode.data || {}),
                    title: normalized || 'Frame',
                },
            };
        });
    };

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
                onDoubleClick={startEditingTitle}
                onPointerDown={(e) => {
                    if (!isEditing) return;
                    e.stopPropagation();
                }}
            >
                {isEditing ? (
                    <input
                        type="text"
                        className="frame-title-input"
                        value={editValue}
                        autoFocus
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={commitTitle}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                commitTitle();
                            } else if (e.key === 'Escape') {
                                e.preventDefault();
                                setEditingNodeId(null);
                                setEditTypingSeed(null);
                            }
                        }}
                    />
                ) : (
                    <span className="frame-title-text">{title}</span>
                )}
                <span className={`frame-title-chip ${clipEnabled ? 'is-on' : 'is-off'}`}>
                    {clipEnabled ? 'Clip' : 'Sem clip'}
                </span>
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
