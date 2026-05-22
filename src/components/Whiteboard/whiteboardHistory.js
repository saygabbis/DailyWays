/** Utilitários de histórico (undo/redo) para o whiteboard. */

export function cloneNode(node) {
    if (!node) return null;
    return JSON.parse(JSON.stringify(node));
}

export function captureNodesSnapshot(store, ids) {
    const state = store.getState();
    return ids
        .map((id) => {
            const node = state.nodes.find((n) => n.id === id);
            return node ? { id, node: cloneNode(node) } : null;
        })
        .filter(Boolean);
}

export function nodeToCollabPatch(node) {
    if (!node) return {};
    const patch = { ...node };
    delete patch.id;
    delete patch.createdAt;
    delete patch.updatedAt;
    return patch;
}

/** Executa mutação e grava before/after para undo (tipo nodes_replace). */
export function recordNodesMutation(store, ids, mutateFn) {
    const uniqueIds = [...new Set(ids)].filter(Boolean);
    if (!uniqueIds.length) return;

    const before = captureNodesSnapshot(store, uniqueIds);
    mutateFn();
    const after = captureNodesSnapshot(store, uniqueIds);

    const changed =
        before.length > 0 &&
        before.some((b, i) => {
            const a = after[i];
            if (!a) return true;
            return JSON.stringify(b.node) !== JSON.stringify(a.node);
        });

    if (changed) {
        store.getState().pushHistory({
            type: 'nodes_replace',
            payload: { before, after },
        });
    }
}

export function pushNodesAddBatch(store, nodes) {
    if (!nodes?.length) return;
    store.getState().pushHistory({
        type: 'nodes_add_batch',
        payload: { nodes: nodes.map((n) => cloneNode(n)) },
    });
}

export function patchNodeWithHistory(store, collabPatchNode, id, patch) {
    recordNodesMutation(store, [id], () => collabPatchNode(id, patch));
}

export function patchNodesWithHistory(store, collabPatchNodes, patches) {
    const ids = patches.map((p) => p.id);
    recordNodesMutation(store, ids, () => collabPatchNodes(patches));
}
