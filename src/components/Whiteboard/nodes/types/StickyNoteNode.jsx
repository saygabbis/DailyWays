import React, { useState, useEffect } from 'react';
import BaseNode from './BaseNode';
import { useWhiteboardStore } from '../../../stores/whiteboardStore';
import { useCollabPatch } from '../../../collab/whiteboard/CollabOpsContext.jsx';
import { recordNodesMutation } from '../whiteboardHistory';
import { contrastingTextColor } from '../../../utils/contrastingTextColor';

export default function StickyNoteNode({ node, onNodePointerDown, onNodeContextMenu }) {
    const text = node.data?.text ?? '';
    const color = node.style?.backgroundColor ?? '#fef08a';
    const textColor = node.style?.color ?? contrastingTextColor(color);
    const { editingNodeId, editTypingSeed, setEditingNodeId, setEditTypingSeed } = useWhiteboardStore();
    const { collabPatchNode } = useCollabPatch();
    const isEditing = editingNodeId === node.id;
    const [editValue, setEditValue] = useState(text);
    useEffect(() => {
        if (!isEditing) return;
        if (editTypingSeed) {
            setEditValue((text || '') + editTypingSeed);
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
                className="whiteboard-node sticky-note"
                style={{
                    width: node.width,
                    height: node.height,
                    backgroundColor: color,
                }}
            >
                <textarea
                    className="sticky-note-text"
                    value={isEditing ? editValue : text}
                    readOnly={!isEditing}
                    onChange={isEditing ? (e) => setEditValue(e.target.value) : undefined}
                    onBlur={isEditing ? handleBlur : undefined}
                    autoFocus={isEditing}
                    style={{
                        width: '100%',
                        height: '100%',
                        resize: 'none',
                        border: 'none',
                        background: 'transparent',
                        padding: 8,
                        color: textColor,
                    }}
                />
            </div>
        </BaseNode>
    );
}
