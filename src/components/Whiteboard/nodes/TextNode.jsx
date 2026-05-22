import React, { useState, useEffect } from 'react';
import BaseNode from './BaseNode';
import { useWhiteboardStore } from '../../../stores/whiteboardStore';
import { useCollabPatch } from '../../../collab/whiteboard/CollabOpsContext.jsx';
import { recordNodesMutation } from '../whiteboardHistory';

export default function TextNode({ node, onNodePointerDown, onNodeContextMenu }) {
    const text = node.data?.text ?? 'Text';
    const { editingNodeId, editTypingSeed, setEditingNodeId, setEditTypingSeed } = useWhiteboardStore();
    const { collabPatchNode } = useCollabPatch();
    const isEditing = editingNodeId === node.id;
    const [editValue, setEditValue] = useState(text);
    useEffect(() => {
        if (!isEditing) return;
        if (editTypingSeed) {
            const base = text === 'Text' ? '' : (text || '');
            setEditValue(base + editTypingSeed);
            setEditTypingSeed(null);
        } else {
            setEditValue(text);
        }
    }, [isEditing, text, editTypingSeed, setEditTypingSeed]);

    const handleBlur = () => {
        if (editValue !== text) {
            recordNodesMutation(useWhiteboardStore, [node.id], () => {
                collabPatchNode(node.id, { data: { ...node.data, text: editValue } });
            });
        }
        setEditingNodeId(null);
        setEditTypingSeed(null);
    };

    return (
        <BaseNode node={node} onNodePointerDown={onNodePointerDown} onNodeContextMenu={onNodeContextMenu}>
            <div
                className="whiteboard-node text-node"
                style={{
                    width: node.width,
                    height: node.height,
                    fontSize: node.style?.fontSize ?? 16,
                    color: node.style?.color ?? 'var(--text-primary)',
                }}
            >
                {isEditing ? (
                    <textarea
                        className="text-node-edit"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleBlur}
                        autoFocus
                        style={{ width: '100%', height: '100%', resize: 'none', border: '1px solid var(--border-color)', padding: 4 }}
                    />
                ) : (
                    text
                )}
            </div>
        </BaseNode>
    );
}
