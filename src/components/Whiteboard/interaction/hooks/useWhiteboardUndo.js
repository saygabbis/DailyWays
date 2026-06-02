import { useCallback } from 'react';
import { useCollabPatch } from '../../../../collab/space/ops/SpaceCollabOpsContext.jsx';
import { performUndo, performRedo } from '../../core/history/undoController';

export function useWhiteboardUndo() {
    const {
        collabPatchNode,
        collabCreateNode,
        collabDeleteNodes,
        collabEmitNodeOps,
    } = useCollabPatch();
    const collabApi = { collabPatchNode, collabCreateNode, collabDeleteNodes, collabEmitNodeOps };

    const undo = useCallback(
        () => performUndo(collabApi),
        [collabPatchNode, collabCreateNode, collabDeleteNodes, collabEmitNodeOps],
    );
    const redo = useCallback(
        () => performRedo(collabApi),
        [collabPatchNode, collabCreateNode, collabDeleteNodes, collabEmitNodeOps],
    );

    return { undo, redo };
}
