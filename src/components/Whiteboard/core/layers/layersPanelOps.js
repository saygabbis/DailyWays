import { uuidv4 } from '../../../../utils/uuid';
import { getDefaultNodePayload } from '../../../../stores/whiteboardStore';
import { insertNode } from '../../../../services/whiteboardService';
import { buildNodesById, nodeToWorld } from '../ops/whiteboardNodeOps';
import { recordNodesMutation, patchNodesWithHistory, pushNodesAddBatch } from '../history/whiteboardHistory';
import { CONTAINER_NODE_TYPES } from '../../interaction/viewport/viewportUtils';
import { getNodePageId, filterNodesByPage } from '../pages/whiteboardPages';
import { collectDescendantIds, isDescendantOf } from '../layers/layerTreeUtils';
import { normalizeFrameConstraints } from '../frame/frameConstraints.js';

const PASTE_STEP = 20;

export function getSiblings(nodes, parentId, pageId) {
    const pid = parentId ?? null;
    return nodes
        .filter((n) => getNodePageId(n) === pageId && (n.parentId ?? null) === pid)
        .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
}

/** Aninha filho dentro de um frame/coluna/tabela (coords locais). */
export function nestNodeInContainer(store, collabPatchNode, childId, parentId) {
    const state = store.getState();
    const nodes = state.nodes;
    const child = nodes.find((n) => n.id === childId);
    const parent = nodes.find((n) => n.id === parentId);
    if (!child || !parent || !CONTAINER_NODE_TYPES.includes(parent.type)) return false;
    if (isDescendantOf(childId, parentId, nodes)) return false;

    const byId = buildNodesById(nodes);
    const childWorld = nodeToWorld(child, byId);
    const parentWorld = nodeToWorld(parent, byId);
    const ids = [childId, ...collectDescendantIds(childId, nodes)];

    recordNodesMutation(store, ids, () => {
        const patch = {
            parentId: parent.id,
            x: childWorld.x - parentWorld.x,
            y: childWorld.y - parentWorld.y,
        };
        if (parent.type === 'frame') {
            patch.data = {
                ...(child.data || {}),
                constraints: normalizeFrameConstraints(child.data?.constraints),
            };
        }
        collabPatchNode(childId, {
            ...patch,
        });
    });
    return true;
}

/** Remove do grupo mantendo posição no mundo. */
export function unnestNodeToRoot(store, collabPatchNode, nodeId) {
    const state = store.getState();
    const node = state.nodes.find((n) => n.id === nodeId);
    if (!node?.parentId) return false;

    const byId = buildNodesById(state.nodes);
    const world = nodeToWorld(node, byId);
    recordNodesMutation(store, [nodeId], () => {
        collabPatchNode(nodeId, { parentId: null, x: world.x, y: world.y });
    });
    return true;
}

/** Reordena entre irmãos (mesmo parentId) via zIndex. */
export function reorderLayerSibling(store, collabPatchNodes, dragId, targetId, place) {
    const state = store.getState();
    const pageId = state.activePageId;
    const drag = state.nodes.find((n) => n.id === dragId);
    const target = state.nodes.find((n) => n.id === targetId);
    if (!drag || !target) return;

    const parentId = target.parentId ?? null;
    if ((drag.parentId ?? null) !== parentId) {
        unnestOrReparentToSiblingParent(store, collabPatchNodes, dragId, targetId, place);
        return;
    }

    const siblings = getSiblings(state.nodes, parentId, pageId).filter((n) => n.id !== dragId);
    const targetIdx = siblings.findIndex((n) => n.id === targetId);
    if (targetIdx < 0) return;

    const insertIdx = place === 'before' ? targetIdx : targetIdx + 1;
    const ordered = [...siblings];
    ordered.splice(insertIdx, 0, drag);

    const patches = ordered.map((n, i) => ({ id: n.id, patch: { zIndex: i } }));
    patchNodesWithHistory(store, collabPatchNodes, patches);
}

function unnestOrReparentToSiblingParent(store, collabPatchNodes, dragId, targetId, place) {
    const state = store.getState();
    const drag = state.nodes.find((n) => n.id === dragId);
    const target = state.nodes.find((n) => n.id === targetId);
    if (!drag || !target) return;

    const byId = buildNodesById(state.nodes);
    const world = nodeToWorld(drag, byId);
    const parentId = target.parentId ?? null;
    let localX = world.x;
    let localY = world.y;

    if (parentId) {
        const parent = state.nodes.find((n) => n.id === parentId);
        if (parent) {
            const pw = nodeToWorld(parent, byId);
            localX = world.x - pw.x;
            localY = world.y - pw.y;
        }
    }

    const pageId = state.activePageId;
    const siblings = getSiblings(state.nodes, parentId, pageId).filter((n) => n.id !== dragId);
    const targetIdx = siblings.findIndex((n) => n.id === targetId);
    const insertIdx = place === 'before' ? Math.max(0, targetIdx) : targetIdx + 1;
    const ordered = [...siblings];
    ordered.splice(insertIdx, 0, { ...drag, parentId, x: localX, y: localY });

    const patches = ordered.map((n, i) => {
        if (n.id === dragId) {
            return { id: dragId, patch: { parentId, x: localX, y: localY, zIndex: i } };
        }
        return { id: n.id, patch: { zIndex: i } };
    });

    patchNodesWithHistory(store, collabPatchNodes, patches);
}

export async function duplicateLayerSubtree(store, collab, nodeId, ctx) {
    const state = store.getState();
    const pageId = state.activePageId;
    const pageNodes = filterNodesByPage(state.nodes, pageId);
    const root = pageNodes.find((n) => n.id === nodeId);
    if (!root) return [];

    const desc = collectDescendantIds(nodeId, pageNodes);
    const subtree = [root, ...desc.map((id) => pageNodes.find((n) => n.id === id)).filter(Boolean)];
    const subtreeIds = new Set(subtree.map((n) => n.id));

    const byId = buildNodesById(state.nodes);
    const idMap = new Map();
    const created = [];

    const sorted = [...subtree].sort((a, b) => {
        const depth = (n) => {
            let d = 0;
            let p = n.parentId;
            while (p && subtreeIds.has(p)) {
                d++;
                p = state.nodes.find((x) => x.id === p)?.parentId;
            }
            return d;
        };
        return depth(a) - depth(b);
    });

    for (const n of sorted) {
        const copy = JSON.parse(JSON.stringify(n));
        copy.id = uuidv4();
        idMap.set(n.id, copy.id);
        copy.data = { ...copy.data, pageId };
        copy.createdBy = ctx.userId ?? null;
        delete copy.createdAt;
        delete copy.updatedAt;

        const parentInSubtree = n.parentId && subtreeIds.has(n.parentId);
        if (parentInSubtree) {
            copy.parentId = idMap.get(n.parentId);
            copy.x = n.x ?? 0;
            copy.y = n.y ?? 0;
        } else {
            const world = nodeToWorld(n, byId);
            copy.parentId = null;
            copy.x = world.x + PASTE_STEP;
            copy.y = world.y + PASTE_STEP;
        }

        if (ctx.collabConnected) {
            ctx.collabCreateNode(copy);
        } else {
            const res = await insertNode(ctx.spaceId, copy, ctx.userId);
            if (!res.success) continue;
            ctx.addNode(copy);
        }
        created.push(copy);
    }

    if (created.length) pushNodesAddBatch(store, created);
    const rootNewId = idMap.get(nodeId);
    if (rootNewId) state.setSelection([rootNewId]);
    return created.map((n) => n.id);
}

export function deleteLayerSubtree(store, collabDeleteNodes, nodeIds) {
    const state = store.getState();
    const pageId = state.activePageId;
    const pageNodes = filterNodesByPage(state.nodes, pageId);
    const toDelete = new Set();

    for (const id of nodeIds) {
        toDelete.add(id);
        collectDescendantIds(id, pageNodes).forEach((d) => toDelete.add(d));
    }

    const nodes = state.nodes.filter((n) => toDelete.has(n.id));
    if (!nodes.length) return;

    state.pushHistory({
        type: 'node_delete',
        payload: { nodes: nodes.map((n) => JSON.parse(JSON.stringify(n))) },
    });
    collabDeleteNodes([...toDelete]);
    state.setSelection(state.selectedNodeIds.filter((id) => !toDelete.has(id)));
}

/** Clona todos os nós de uma página para outra (nova página). */
export async function clonePageNodes(store, fromPageId, toPageId, ctx) {
    const state = store.getState();
    const sources = filterNodesByPage(state.nodes, fromPageId);
    if (!sources.length) return [];

    const roots = sources.filter((n) => !n.parentId || !sources.some((p) => p.id === n.parentId));
    const sourceIds = new Set(sources.map((n) => n.id));
    const byId = buildNodesById(state.nodes);
    const idMap = new Map();
    const created = [];

    const sorted = [...sources].sort((a, b) => {
        const depth = (n) => {
            let d = 0;
            let p = n.parentId;
            while (p && sourceIds.has(p)) {
                d++;
                p = state.nodes.find((x) => x.id === p)?.parentId;
            }
            return d;
        };
        return depth(a) - depth(b);
    });

    for (const n of sorted) {
        const copy = JSON.parse(JSON.stringify(n));
        copy.id = uuidv4();
        idMap.set(n.id, copy.id);
        copy.data = { ...copy.data, pageId: toPageId };
        copy.createdBy = ctx.userId ?? null;
        delete copy.createdAt;
        delete copy.updatedAt;

        if (n.parentId && sourceIds.has(n.parentId)) {
            copy.parentId = idMap.get(n.parentId);
            copy.x = n.x ?? 0;
            copy.y = n.y ?? 0;
        } else {
            const world = nodeToWorld(n, byId);
            copy.parentId = null;
            copy.x = world.x;
            copy.y = world.y;
        }

        if (ctx.collabConnected) {
            ctx.collabCreateNode(copy);
        } else {
            const res = await insertNode(ctx.spaceId, copy, ctx.userId);
            if (!res.success) continue;
            ctx.addNode(copy);
        }
        created.push(copy);
    }

    if (created.length) pushNodesAddBatch(store, created);
    return created.map((n) => n.id);
}

export async function deletePageNodes(store, collabDeleteNodes, pageId) {
    const state = store.getState();
    const onPage = filterNodesByPage(state.nodes, pageId);
    if (!onPage.length) return;
    state.pushHistory({
        type: 'node_delete',
        payload: { nodes: onPage.map((n) => JSON.parse(JSON.stringify(n))) },
    });
    collabDeleteNodes(onPage.map((n) => n.id));
}

export async function createFrameLayer(store, collab, ctx) {
    const state = store.getState();
    const pageId = state.activePageId;
    const pageNodes = filterNodesByPage(state.nodes, pageId);
    const maxZ = Math.max(0, ...pageNodes.map((n) => n.zIndex ?? 0));

    const payload = getDefaultNodePayload('frame', 120, 120);
    payload.type = 'frame';
    payload.zIndex = maxZ + 1;
    payload.data = { ...payload.data, pageId, title: 'Frame', layerName: 'Frame' };

    if (ctx.collabConnected) {
        collab.collabCreateNode({ ...payload, createdBy: ctx.userId ?? null });
    } else {
        const res = await insertNode(ctx.spaceId, payload, ctx.userId);
        if (res.success) ctx.addNode(payload);
    }
    state.pushHistory({ type: 'node_add', payload: { node: JSON.parse(JSON.stringify(payload)) } });
    state.setSelection([payload.id]);
    return payload.id;
}
