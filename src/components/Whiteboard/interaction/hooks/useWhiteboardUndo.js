import { useCallback, useMemo } from 'react';
import { useCollabPatch } from '../../../../collab/space/ops/useCollabPatch';
import { performUndo, performRedo } from '../../core/history/undoController';

export function useWhiteboardUndo() {
    const {
        collabPatchNode,
        collabCreateNode,
        collabDeleteNodes,
        collabEmitNodeOps,
    } = useCollabPatch();
    // Memoizado: um objeto novo a cada render recriaria undo/redo (e quem depende deles) sempre.
    const collabApi = useMemo(
        () => ({ collabPatchNode, collabCreateNode, collabDeleteNodes, collabEmitNodeOps }),
        [collabPatchNode, collabCreateNode, collabDeleteNodes, collabEmitNodeOps],
    );

    const undo = useCallback(() => performUndo(collabApi), [collabApi]);
    const redo = useCallback(() => performRedo(collabApi), [collabApi]);

    return { undo, redo };
}
