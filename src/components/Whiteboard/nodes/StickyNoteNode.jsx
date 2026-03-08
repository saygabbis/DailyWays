import React, { useState, useEffect } from 'react';
import BaseNode from './BaseNode';
import { useWhiteboardStore } from '../../../stores/whiteboardStore';

export default function StickyNoteNode({ node, onNodePointerDown }) {
    const text = node.data?.text ?? '';
    const color = node.style?.backgroundColor ?? '#fef08a';
    const { editingNodeId, setEditingNodeId, patchNode } = useWhiteboardStore();
    const isEditing = editingNodeId === node.id;
    const [editValue, setEditValue] = useState(text);
    useEffect(() => {
        if (isEditing) setEditValue(text);
    }, [isEditing, text]);

    const handleBlur = () => {
        if (editValue !== text) patchNode(node.id, { data: { ...node.data, text: editValue } });
        setEditingNodeId(null);
    };

    return (
        <BaseNode node={node} onNodePointerDown={onNodePointerDown}>
            <div
                className="whiteboard-node sticky-note"
                style={{
                    width: node.width,
                    height: node.height,
                    backgroundColor: color,
                    transform: `rotate(${node.rotation ?? 0}deg)`,
                }}
            >
                <textarea
                    className="sticky-note-text"
                    value={isEditing ? editValue : text}
                    readOnly={!isEditing}
                    onChange={isEditing ? (e) => setEditValue(e.target.value) : undefined}
                    onBlur={isEditing ? handleBlur : undefined}
                    autoFocus={isEditing}
                    style={{ width: '100%', height: '100%', resize: 'none', border: 'none', background: 'transparent', padding: 8 }}
                />
            </div>
        </BaseNode>
    );
}
