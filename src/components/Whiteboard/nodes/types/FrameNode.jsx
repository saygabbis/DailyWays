import React, { memo, useCallback, useRef, useEffect } from 'react';
import BaseNode from './BaseNode';
import AppearanceRenderer from '../../shared/AppearanceRenderer.jsx';
import { sameNodeVisual } from '../../shared/appearanceStyle.js';
import { useWhiteboardStore, isCreationTool } from '../../../../stores/whiteboardStore';
import { useWhiteboardSelectionStore } from '../../../../stores/whiteboardSelectionStore';
import { pointerDownUpdateSelection } from '../../interaction/selection/nodeSelectionPointer';
import { useEditableNodeField } from '../../interaction/hooks/useEditableNodeField';

const FrameNodeVisual = memo(function FrameNodeVisual({ node, onTitlePointerDown, onTitleContextMenu }) {
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
            className="whiteboard-node frame-node frame-node--select-title-only"
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
                onContextMenu={onTitleContextMenu}
                onPointerDown={(e) => {
                    if (isEditing) {
                        e.stopPropagation();
                        return;
                    }
                    onTitlePointerDown?.(e);
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

export default function FrameNode({
    node,
    onNodePointerDown,
    onNodeContextMenu,
    disableDragPreview = false,
    embedded = false,
}) {
    const activeTool = useWhiteboardSelectionStore((s) => s.activeTool);
    const selectionListenersCleanupRef = useRef(null);

    useEffect(() => () => selectionListenersCleanupRef.current?.(), []);

    const handleTitlePointerDown = useCallback(
        (e) => {
            if (e.button === 1) return;
            e.stopPropagation();
            if (e.button !== 0) return;
            if (isCreationTool(activeTool) && activeTool !== 'connector') {
                onNodePointerDown?.(e, node.id);
                return;
            }
            selectionListenersCleanupRef.current?.();
            selectionListenersCleanupRef.current = pointerDownUpdateSelection(e, node.id);
            onNodePointerDown?.(e, node.id);
        },
        [activeTool, node.id, onNodePointerDown]
    );

    return (
        <BaseNode
            node={node}
            onNodePointerDown={onNodePointerDown}
            onNodeContextMenu={onNodeContextMenu}
            disableDragPreview={disableDragPreview}
            embedded={embedded}
            selectViaTitleOnly={embedded}
        >
            <FrameNodeVisual
                node={node}
                onTitlePointerDown={handleTitlePointerDown}
                onTitleContextMenu={(e) => {
                    e.stopPropagation();
                    onNodeContextMenu?.(e, node.id);
                }}
            />
        </BaseNode>
    );
}
