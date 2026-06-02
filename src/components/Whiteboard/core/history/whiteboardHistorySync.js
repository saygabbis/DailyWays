/** Aplica no collab o inverso (undo) ou replay (redo) de uma entrada do histórico local. */
import { patchToOps } from '@dailyways/collab-protocol';
import { nodeToCollabOps } from './whiteboardHistory.js';

function emitPatch(collab, nodeId, patch) {
    if (!nodeId || !patch || !collab?.collabEmitNodeOps) return;
    const ops = patchToOps('node', nodeId, patch);
    if (ops.length) collab.collabEmitNodeOps(ops);
}

function emitFullNode(collab, node) {
    if (!node?.id || !collab?.collabEmitNodeOps) return;
    const ops = nodeToCollabOps(node);
    if (ops.length) collab.collabEmitNodeOps(ops);
}

export function applyHistoryToCollab(entry, direction, collab) {
    if (!entry || !collab) return;
    const undo = direction === 'undo';

    switch (entry.type) {
        case 'node_delete': {
            const list = entry.payload.nodes ?? (entry.payload.node ? [entry.payload.node] : []);
            if (undo) {
                for (const node of list) {
                    collab.collabCreateNode?.(node, { remoteOnly: true });
                }
            } else {
                collab.collabDeleteNodes?.(list.map((n) => n.id), { remoteOnly: true });
            }
            break;
        }
        case 'node_add': {
            const node = entry.payload.node;
            if (!node?.id) break;
            if (undo) collab.collabDeleteNodes?.([node.id], { remoteOnly: true });
            else collab.collabCreateNode?.(node, { remoteOnly: true });
            break;
        }
        case 'nodes_add_batch': {
            const batch = entry.payload.nodes ?? [];
            if (undo) collab.collabDeleteNodes?.(batch.map((n) => n.id), { remoteOnly: true });
            else {
                for (const node of batch) collab.collabCreateNode?.(node, { remoteOnly: true });
            }
            break;
        }
        case 'nodes_replace': {
            const items = undo ? entry.payload.before : entry.payload.after;
            for (const { id, node } of items ?? []) {
                if (id && node) emitFullNode(collab, { ...node, id });
            }
            break;
        }
        case 'node_move':
        case 'node_resize':
        case 'node_edit': {
            const patch = undo ? entry.payload.before : entry.payload.after;
            if (patch && entry.payload.id) emitPatch(collab, entry.payload.id, patch);
            break;
        }
        default:
            break;
    }
}
