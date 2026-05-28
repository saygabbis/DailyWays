import React, { useRef, useCallback, useEffect } from 'react';
import { useWhiteboardStore, isCreationTool } from '../../../../stores/whiteboardStore';
import { useWhiteboardSelectionStore } from '../../../../stores/whiteboardSelectionStore';
import { getNodeTransformStyle } from '../../core/nodeTransform';
import { pointerDownUpdateSelection } from '../../interaction/selection/nodeSelectionPointer';
import { useWhiteboardRemoteSelection } from '../../../../hooks/useWhiteboardRemoteSelection';
import { useNodeDragTranslate, dragTranslateStyle } from '../../interaction/hooks/useNodeDragTranslate';

export default function BaseNode({
    node,
    children,
    onNodePointerDown,
    onNodeContextMenu,
    disableDragPreview = false,
    embedded = false,
    selectViaTitleOnly = false,
}) {
    const ref = useRef(null);
    const selectionListenersCleanupRef = useRef(null);
    const setEditingNodeId = useWhiteboardSelectionStore((s) => s.setEditingNodeId);

    useEffect(() => () => selectionListenersCleanupRef.current?.(), []);
    const activeTool = useWhiteboardSelectionStore((s) => s.activeTool);
    const isSelected = useWhiteboardSelectionStore((s) => s.selectedNodeIds.includes(node.id));
    const dragPreview = useNodeDragTranslate(node.id);
    const dragTranslate = disableDragPreview ? null : dragPreview;
    const { remoteSelectionByNodeId } = useWhiteboardRemoteSelection();
    const remotePeers = remoteSelectionByNodeId[node.id];
    const isRemoteSelected = Boolean(remotePeers?.length);

    const handlePointerDown = useCallback(
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

    const handleContextMenu = useCallback(
        (e) => {
            onNodeContextMenu?.(e, node.id);
        },
        [node.id, onNodeContextMenu]
    );

    const handleDoubleClick = useCallback(
        (e) => {
            e.stopPropagation();
            if (node.type === 'text' || node.type === 'sticky_note' || node.type === 'link') {
                setEditingNodeId(node.id);
            }
        },
        [node.id, node.type, setEditingNodeId]
    );

    return (
        <div
            ref={ref}
            data-node-id={node.id}
            className={`whiteboard-node-wrapper ${isSelected ? 'selected' : ''} ${isRemoteSelected ? 'whiteboard-node--remote-selected' : ''}${dragTranslate ? ' is-drag-preview' : ''}`}
            style={{
                position: embedded ? 'relative' : 'absolute',
                left: embedded ? undefined : node.x,
                top: embedded ? undefined : node.y,
                width: embedded ? '100%' : node.width,
                height: embedded ? '100%' : node.height,
                transform: dragTranslateStyle(dragTranslate),
                pointerEvents: selectViaTitleOnly ? 'none' : undefined,
                ...(isRemoteSelected && remotePeers[0]?.color
                    ? { '--remote-selection-color': remotePeers[0].color }
                    : {}),
            }}
            onPointerDown={selectViaTitleOnly ? undefined : handlePointerDown}
            onContextMenu={handleContextMenu}
            onDoubleClick={handleDoubleClick}
            onDragStart={(e) => e.preventDefault()}
        >
            <div
                className="whiteboard-node-inner"
                style={{ width: '100%', height: '100%', ...getNodeTransformStyle(node) }}
            >
                {children}
            </div>
        </div>
    );
}
