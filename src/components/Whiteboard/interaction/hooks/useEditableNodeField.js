import { useState, useEffect, useCallback } from 'react';
import { useWhiteboardStore } from '../../../../stores/whiteboardStore';
import { useCollabPatch } from '../../../../collab/whiteboard/CollabOpsContext.jsx';
import { recordNodesMutation } from '../../core/history/whiteboardHistory';

/**
 * Campo editável em nós de texto (Text, Sticky, Comment).
 */
export function useEditableNodeField(nodeId, field, { displayValue, emptySeedValue = '' } = {}) {
    const { editingNodeId, editTypingSeed, setEditingNodeId, setEditTypingSeed } = useWhiteboardStore();
    const { collabPatchNode } = useCollabPatch();
    const isEditing = editingNodeId === nodeId;
    const [editValue, setEditValue] = useState(displayValue ?? '');

    useEffect(() => {
        if (!isEditing) return;
        if (editTypingSeed) {
            const base = displayValue === emptySeedValue ? '' : (displayValue || '');
            setEditValue(base + editTypingSeed);
            setEditTypingSeed(null);
        } else {
            setEditValue(displayValue ?? '');
        }
    }, [isEditing, displayValue, editTypingSeed, setEditTypingSeed, emptySeedValue]);

    const commitBlur = useCallback(
        (node, buildPatch) => {
            if (editValue !== displayValue) {
                recordNodesMutation(useWhiteboardStore, [nodeId], () => {
                    collabPatchNode(nodeId, buildPatch(node, editValue));
                });
            }
            setEditingNodeId(null);
            setEditTypingSeed(null);
        },
        [editValue, displayValue, nodeId, collabPatchNode, setEditingNodeId, setEditTypingSeed]
    );

    return { isEditing, editValue, setEditValue, commitBlur };
}
