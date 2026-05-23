import React, { useState, useEffect } from 'react';
import BaseNode from './BaseNode';
import { useWhiteboardStore } from '../../../../stores/whiteboardStore';
import { useCollabPatch } from '../../../../collab/whiteboard/CollabOpsContext.jsx';
import { recordNodesMutation } from '../../core/history/whiteboardHistory';

export default function CommentNode({ node, onNodePointerDown, onNodeContextMenu }) {
    const message = node.data?.message ?? '';
    const { editingNodeId, setEditingNodeId } = useWhiteboardStore();
    const { collabPatchNode } = useCollabPatch();
    const isEditing = editingNodeId === node.id;
    const [editValue, setEditValue] = useState(message);
    useEffect(() => {
        if (isEditing) setEditValue(message);
    }, [isEditing, message]);

    const handleBlur = () => {
        if (editValue !== message) {
            recordNodesMutation(useWhiteboardStore, [node.id], () => {
                collabPatchNode(node.id, { data: { ...node.data, message: editValue } });
            });
        }
        setEditingNodeId(null);
    };

    return (
        <BaseNode node={node} onNodePointerDown={onNodePointerDown} onNodeContextMenu={onNodeContextMenu}>
            <div
                className="whiteboard-node comment-node"
                style={{
                    width: node.width,
                    height: node.height,
                    backgroundColor: '#fef9c3',
                    border: '1px solid #facc15',
                    borderRadius: 8,
                    padding: 8,
                    fontSize: 12,
                }}
            >
                {isEditing ? (
                    <textarea
                        className="comment-node-edit"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleBlur}
                        autoFocus
                        style={{ width: '100%', height: '100%', resize: 'none', padding: 0, fontSize: 12 }}
                    />
                ) : (
                    message
                )}
            </div>
        </BaseNode>
    );
}
