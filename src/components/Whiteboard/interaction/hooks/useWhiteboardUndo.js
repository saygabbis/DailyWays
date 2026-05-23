import { useCallback } from 'react';
import { useCollabPatch } from '../../../../collab/whiteboard/CollabOpsContext.jsx';
import { performUndo, performRedo } from '../../core/history/undoController';

export function useWhiteboardUndo() {
    const { collabPatchNode, collabCreateNode, collabDeleteNodes } = useCollabPatch();
    const collabApi = { collabPatchNode, collabCreateNode, collabDeleteNodes };

    const undo = useCallback(() => performUndo(collabApi), [collabPatchNode, collabCreateNode, collabDeleteNodes]);
    const redo = useCallback(() => performRedo(collabApi), [collabPatchNode, collabCreateNode, collabDeleteNodes]);

    return { undo, redo };
}
