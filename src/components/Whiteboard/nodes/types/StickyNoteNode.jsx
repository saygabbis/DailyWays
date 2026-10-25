import { useState, useEffect } from 'react';
import { TEXT } from '@dailyways/limits';
import BaseNode from './BaseNode';
import { useWhiteboardStore, useWhiteboardFields } from '../../../../stores/whiteboardStore';
import { useCollabPatch } from '../../../../collab/space/ops/useCollabPatch';
import { recordNodesMutation } from '../../core/history/whiteboardHistory';
import { contrastingTextColor } from '../../../../utils/contrastingTextColor';
import { getTextStyleFromNode, scaleTextCss, textStyleToCss } from '../../shared/textStyle';
import VectorViewportShell from '../../shared/VectorViewportShell.jsx';
import { useSharpRenderZoom } from '../../interaction/viewport/useWhiteboardViewportZoom';

export default function StickyNoteNode({ node, onNodePointerDown, onNodeContextMenu }) {
    const text = node.data?.text ?? '';
    const color = node.style?.backgroundColor ?? '#fef08a';
    const textStyle = getTextStyleFromNode(node);
    const textColor = textStyle.color ?? contrastingTextColor(color);
    const renderZoom = useSharpRenderZoom();
    const typographyCss = scaleTextCss(textStyleToCss({ ...textStyle, color: textColor }), renderZoom);
    const { editingNodeId, editTypingSeed, setEditingNodeId, setEditTypingSeed } = useWhiteboardFields('editingNodeId', 'editTypingSeed', 'setEditingNodeId', 'setEditTypingSeed');
    const { collabPatchNode } = useCollabPatch();
    const isEditing = editingNodeId === node.id;
    const [editValue, setEditValue] = useState(text);
    useEffect(() => {
        if (!isEditing) return;
        if (editTypingSeed) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- consome o "typing seed" do store do whiteboard ao entrar em edição
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
            <VectorViewportShell
                width={node.width}
                height={node.height}
                className="whiteboard-node sticky-note"
                style={{ backgroundColor: color }}
            >
                <textarea
                    className="sticky-note-text"
                    value={isEditing ? editValue : text}
                    maxLength={TEXT.whiteboardNodeText}
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
                        padding: 8 * renderZoom,
                        boxSizing: 'border-box',
                        ...typographyCss,
                    }}
                />
            </VectorViewportShell>
        </BaseNode>
    );
}
