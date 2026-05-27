import React, { useRef, useCallback } from 'react';
import { useWhiteboardStore, isCreationTool } from '../../../../stores/whiteboardStore';
import { useWhiteboardSelectionStore } from '../../../../stores/whiteboardSelectionStore';
import { getNodeTransformStyle } from '../../core/nodeTransform';
import { resolveNodeClickSelection } from '../../core/layers/whiteboardGroupOps';
import { useWhiteboardRemoteSelection } from '../../../../hooks/useWhiteboardRemoteSelection';
import { useNodeDragTranslate, dragTranslateStyle } from '../../interaction/hooks/useNodeDragTranslate';

export default function BaseNode({ node, children, onNodePointerDown, onNodeContextMenu }) {
    const ref = useRef(null);
    const setSelection = useWhiteboardSelectionStore((s) => s.setSelection);
    const setEditingNodeId = useWhiteboardSelectionStore((s) => s.setEditingNodeId);
    const activeTool = useWhiteboardSelectionStore((s) => s.activeTool);
    const isSelected = useWhiteboardSelectionStore((s) => s.selectedNodeIds.includes(node.id));
    const dragTranslate = useNodeDragTranslate(node.id);
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
            const { nodes, selectedNodeIds } = useWhiteboardStore.getState();
            const next = resolveNodeClickSelection(node.id, nodes, selectedNodeIds, {
                shiftKey: e.shiftKey,
                ctrlKey: e.ctrlKey || e.metaKey,
            });
            setSelection(next);
            onNodePointerDown?.(e, node.id);
        },
        [activeTool, node.id, setSelection, onNodePointerDown]
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
                position: 'absolute',
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height,
                transform: dragTranslateStyle(dragTranslate),
                ...(isRemoteSelected && remotePeers[0]?.color
                    ? { '--remote-selection-color': remotePeers[0].color }
                    : {}),
            }}
            onPointerDown={handlePointerDown}
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
