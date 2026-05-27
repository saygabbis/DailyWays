import { useCallback } from 'react';
import { useWhiteboardStore } from '../../../../stores/whiteboardStore';
import { useCollabPatch } from '../../../../collab/space/ops/SpaceCollabOpsContext.jsx';
import { patchNodeWithHistory } from '../../core/history/whiteboardHistory';
import {
    getAppearanceFromNode,
    mergeAppearance,
    appearanceToNodeStylePatch,
} from '../../shared/appearanceStyle';

export function useInspectorStylePatch(node) {
    const { collabPatchNode } = useCollabPatch();

    const patchAppearance = useCallback(
        (partial) => {
            if (!node?.id) return;
            const current = getAppearanceFromNode(node);
            const next = mergeAppearance(current, partial);
            const patch = appearanceToNodeStylePatch(node, next);
            patchNodeWithHistory(useWhiteboardStore, collabPatchNode, node.id, patch);
        },
        [node, collabPatchNode]
    );

    const patchData = useCallback(
        (dataPartial) => {
            if (!node?.id) return;
            patchNodeWithHistory(useWhiteboardStore, collabPatchNode, node.id, {
                data: { ...(node.data || {}), ...dataPartial },
            });
        },
        [node, collabPatchNode]
    );

    const appearance = node ? getAppearanceFromNode(node) : null;

    return { appearance, patchAppearance, patchData };
}
