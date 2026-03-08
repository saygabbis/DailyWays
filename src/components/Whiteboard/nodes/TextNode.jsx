import React, { useState, useEffect } from 'react';
import BaseNode from './BaseNode';
import { useWhiteboardStore } from '../../../stores/whiteboardStore';

export default function TextNode({ node, onNodePointerDown }) {
    const text = node.data?.text ?? 'Text';
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
                className="whiteboard-node text-node"
                style={{
                    width: node.width,
                    height: node.height,
                    transform: `rotate(${node.rotation ?? 0}deg)`,
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
