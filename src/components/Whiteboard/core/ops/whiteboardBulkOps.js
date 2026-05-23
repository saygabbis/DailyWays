import { captureNodesSnapshot } from '../history/whiteboardHistory.js';
import { useWhiteboardDocumentStore } from '../../../../stores/whiteboardDocumentStore';
import { useWhiteboardSelectionStore } from '../../../../stores/whiteboardSelectionStore';

/**
 * Apaga nós em lote com histórico e limpa seleção.
 */
export async function bulkDeleteNodes(nodeIds, { collabDeleteNodes, collabConnected, deleteNodeService, pushHistory }) {
    if (!nodeIds?.length) return;
    const doc = useWhiteboardDocumentStore.getState();
    const selectedNodes = doc.nodes.filter((n) => nodeIds.includes(n.id));
    pushHistory({
        type: 'node_delete',
        payload: { nodes: captureNodesSnapshot(selectedNodes) },
    });
    if (!collabConnected && deleteNodeService) {
        for (const id of nodeIds) {
            await deleteNodeService(id);
        }
    }
    if (collabDeleteNodes) await collabDeleteNodes(nodeIds);
    doc.deleteNodes(nodeIds);
    useWhiteboardSelectionStore.getState().setSelection([]);
}

/**
 * Duplica IDs via callback createNode (collab ou REST).
 */
export async function bulkDuplicateNodes(nodeIds, createNodeFn, clones) {
    for (const node of clones) {
        await createNodeFn(node);
    }
}
