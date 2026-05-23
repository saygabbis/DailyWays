/** Aplica no collab o inverso (undo) ou replay (redo) de uma entrada do histórico local. */
import { nodeToCollabPatch } from '../history/whiteboardHistory';

export function applyHistoryToCollab(entry, direction, collab) {
    if (!entry || !collab) return;
    const undo = direction === 'undo';

    switch (entry.type) {
        case 'node_delete': {
            const list = entry.payload.nodes ?? (entry.payload.node ? [entry.payload.node] : []);
            if (undo) {
                for (const node of list) collab.collabCreateNode(node);
            } else {
                collab.collabDeleteNodes(list.map((n) => n.id));
            }
            break;
        }
        case 'node_add': {
            const node = entry.payload.node;
            if (!node?.id) break;
            if (undo) collab.collabDeleteNodes([node.id]);
            else collab.collabCreateNode(node);
            break;
        }
        case 'nodes_add_batch': {
            const batch = entry.payload.nodes ?? [];
            if (undo) collab.collabDeleteNodes(batch.map((n) => n.id));
            else {
                for (const node of batch) collab.collabCreateNode(node);
            }
            break;
        }
        case 'nodes_replace': {
            const items = undo ? entry.payload.before : entry.payload.after;
            for (const { id, node } of items ?? []) {
                if (id && node) collab.collabPatchNode(id, nodeToCollabPatch(node));
            }
            break;
        }
        case 'node_move':
        case 'node_resize':
        case 'node_edit': {
            const patch = undo ? entry.payload.before : entry.payload.after;
            if (patch && entry.payload.id) collab.collabPatchNode(entry.payload.id, patch);
            break;
        }
        default:
            break;
    }
}
