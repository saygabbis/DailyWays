import React from 'react';
import BaseNode from './BaseNode';
import { useEditableNodeField } from '../../interaction/hooks/useEditableNodeField';
import { getTextStyleFromNode, textStyleToCss } from '../../shared/textStyle';

export default function TextNode({ node, onNodePointerDown, onNodeContextMenu }) {
    const text = node.data?.text ?? '';
    const textStyle = getTextStyleFromNode(node);
    const { isEditing, editValue, setEditValue, commitBlur } = useEditableNodeField(node.id, 'text', {
        displayValue: text,
        emptySeedValue: '',
    });

    const handleBlur = () => {
        commitBlur(node, (n, value) => ({ data: { ...n.data, text: value } }));
    };

    const css = textStyleToCss(textStyle);

    return (
        <BaseNode node={node} onNodePointerDown={onNodePointerDown} onNodeContextMenu={onNodeContextMenu}>
            <div
                className={`whiteboard-node text-node ${isEditing ? 'text-node--editing' : ''} ${!text && !isEditing ? 'text-node--empty' : ''}`}
                style={{
                    width: node.width,
                    height: node.height,
                    ...css,
                }}
            >
                {isEditing ? (
                    <textarea
                        className="text-node-edit"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleBlur}
                        autoFocus
                        placeholder="Digite aqui…"
                        style={{
                            width: '100%',
                            height: '100%',
                            resize: 'none',
                            font: 'inherit',
                            color: 'inherit',
                            textAlign: 'inherit',
                            letterSpacing: 'inherit',
                            lineHeight: 'inherit',
                        }}
                    />
                ) : (
                    text || <span className="text-node-placeholder">Digite aqui…</span>
                )}
            </div>
        </BaseNode>
    );
}
