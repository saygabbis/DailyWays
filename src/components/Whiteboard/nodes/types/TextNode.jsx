import React from 'react';
import BaseNode from './BaseNode';
import { useEditableNodeField } from '../../interaction/hooks/useEditableNodeField';

export default function TextNode({ node, onNodePointerDown, onNodeContextMenu }) {
    const text = node.data?.text ?? 'Text';
    const { isEditing, editValue, setEditValue, commitBlur } = useEditableNodeField(node.id, 'text', {
        displayValue: text,
        emptySeedValue: 'Text',
    });

    const handleBlur = () => {
        commitBlur(node, (n, value) => ({ data: { ...n.data, text: value } }));
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
