import { useCallback, useMemo } from 'react';
import { useCollabPatch } from '../../../../collab/whiteboard/ops/CollabOpsContext.jsx';
import { useCollab } from '../../../../collab/core/CollabContext.jsx';
import { insertNode, deleteNode as deleteNodeService } from '../../../../services/whiteboardService';
import { useWhiteboardDocumentStore } from '../../../../stores/whiteboardDocumentStore';

/**
 * API única online/offline para criar, patch e apagar nós.
 */
export function useCollabNodeApi(spaceId) {
    const collab = useCollab();
    const collabConnected = Boolean(collab?.connected);
    const {
        collabCreateNode,
        collabPatchNode,
        collabPatchNodes,
        collabDeleteNodes,
    } = useCollabPatch();

    const createNode = useCallback(
        async (payload) => {
            const doc = useWhiteboardDocumentStore.getState();
            doc.addNode(payload);
            if (collabConnected) {
                await collabCreateNode(payload);
            } else if (spaceId) {
                await insertNode(spaceId, payload);
            }
            return payload;
        },
        [collabConnected, collabCreateNode, spaceId]
    );

    const patchNode = useCallback(
        async (nodeId, patch) => {
            useWhiteboardDocumentStore.getState().patchNode(nodeId, patch);
            if (collabConnected) {
                await collabPatchNode(nodeId, patch);
            }
        },
        [collabConnected, collabPatchNode]
    );

    const patchNodes = useCallback(
        async (patches) => {
            useWhiteboardDocumentStore.getState().patchNodes(patches);
            if (collabConnected) {
                await collabPatchNodes(patches);
            }
        },
        [collabConnected, collabPatchNodes]
    );

    const deleteNodes = useCallback(
        async (ids) => {
            if (!ids?.length) return;
            if (collabConnected) {
                await collabDeleteNodes(ids);
            } else {
                for (const id of ids) {
                    await deleteNodeService(id);
                }
                useWhiteboardDocumentStore.getState().deleteNodes(ids);
            }
        },
        [collabConnected, collabDeleteNodes]
    );

    return useMemo(
        () => ({
            collabConnected,
            createNode,
            patchNode,
            patchNodes,
            deleteNodes,
        }),
        [collabConnected, createNode, patchNode, patchNodes, deleteNodes]
    );
}
