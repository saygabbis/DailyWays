import { uuidv4 } from '../../../../utils/uuid';
import { insertNode } from '../../../../services/whiteboardService';
import { findContainerAt } from '../../interaction/viewport/viewportUtils';
import { pushNodesAddBatch, recordNodesMutation } from '../history/whiteboardHistory';
import { resolveDragNodeIds } from '../selection/whiteboardSelectionUtils';
import { assignFreshGroupIdToClones } from '../layers/whiteboardGroupOps';
import { filterNodesByPage } from '../pages/whiteboardPages';

import {
    buildNodesById,
    nodeToWorld,
    worldTopLeftToNodePatch,
    normalizeNodesForClipboard,
} from '../nodeGeometry.js';

export { buildNodesById, nodeToWorld, worldTopLeftToNodePatch, normalizeNodesForClipboard };

const PASTE_STEP = 20;

function cloneNodeForInsert(node, offsetX, offsetY, userId) {
    const newNode = JSON.parse(JSON.stringify(node));
    newNode.id = uuidv4();
    newNode.x = (node.x ?? 0) + offsetX;
    newNode.y = (node.y ?? 0) + offsetY;
    newNode.parentId = null;
    newNode.createdBy = userId ?? null;
    delete newNode.createdAt;
    delete newNode.updatedAt;
    return newNode;
}

/** Evita que texto antigo do SO sobrescreva colagem de nós copiados no app. */
function clearSystemClipboardText() {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText('').catch(() => {});
}

/** Copia nós selecionados para a área de transferência interna. */
export function copyNodesToClipboard(store) {
    const state = store.getState();
    if (!state.selectedNodeIds.length) return false;
    const selected = state.nodes.filter((n) => state.selectedNodeIds.includes(n.id));
    const nodes = normalizeNodesForClipboard(selected, state.nodes);
    state.setClipboardNodes(nodes);
    state.setClipboardPasteGeneration(0);
    clearSystemClipboardText();
    return true;
}

/** Coloca nós copiados na área de transferência (uso em cut). */
export function setClipboardFromNodes(store, nodes) {
    const state = store.getState();
    const normalized = normalizeNodesForClipboard(nodes, state.nodes);
    state.setClipboardNodes(normalized);
    state.setClipboardPasteGeneration(0);
    clearSystemClipboardText();
}

/** Duplica ou cola nós; retorna ids criados. */
export async function insertClonedNodes(nodes, offset, ctx) {
    const { spaceId, userId, collabCreateNode, collabConnected, addNode, store, allNodes } = ctx;
    if (!spaceId || !nodes?.length) return [];

    const createdIds = [];
    const createdNodes = [];
    for (const node of nodes) {
        const worldX = (node.x ?? 0) + offset.x;
        const worldY = (node.y ?? 0) + offset.y;
        const w = node.width ?? 0;
        const h = node.height ?? 0;
        const container = findContainerAt(allNodes, worldX + w / 2, worldY + h / 2);

        const newNode = cloneNodeForInsert(node, offset.x, offset.y, userId);
        if (container) {
            newNode.parentId = container.id;
            newNode.x = worldX - container.x;
            newNode.y = worldY - container.y;
        } else {
            newNode.parentId = null;
            newNode.x = worldX;
            newNode.y = worldY;
        }
        createdNodes.push(newNode);
    }

    assignFreshGroupIdToClones(createdNodes);

    for (const newNode of createdNodes) {
        if (collabConnected) {
            collabCreateNode(newNode);
        } else {
            const res = await insertNode(spaceId, newNode, userId);
            if (!res.success) continue;
            addNode(newNode);
        }
        createdIds.push(newNode.id);
    }
    if (createdNodes.length && store) pushNodesAddBatch(store, createdNodes);
    return createdIds;
}

export async function duplicateSelectedNodes(ctx) {
    const state = ctx.store.getState();
    const selected = state.nodes.filter((n) => state.selectedNodeIds.includes(n.id));
    if (!selected.length) return [];
    const normalized = normalizeNodesForClipboard(selected, state.nodes);
    const ids = await insertClonedNodes(normalized, { x: PASTE_STEP, y: PASTE_STEP }, {
        ...ctx,
        allNodes: state.nodes,
    });
    if (ids.length) state.setSelection(ids);
    return ids;
}

export async function pasteFromClipboard(ctx, options = {}) {
    const state = ctx.store.getState();
    const clipboard = state.clipboardNodes;
    if (!clipboard?.length) return [];

    const inPlace = !!options.inPlace;
    const gen = state.clipboardPasteGeneration ?? 0;
    const offset = inPlace
        ? { x: 0, y: 0 }
        : { x: PASTE_STEP * (gen + 1), y: PASTE_STEP * (gen + 1) };
    const ids = await insertClonedNodes(clipboard, offset, {
        ...ctx,
        allNodes: state.nodes,
    });
    if (ids.length) {
        if (!inPlace) state.setClipboardPasteGeneration(gen + 1);
        state.setSelection(ids);
    }
    return ids;
}

export function nudgeSelectedNodes(store, collabPatchNodes, dx, dy) {
    const state = store.getState();
    if (!state.selectedNodeIds.length) return;
    const ids = resolveDragNodeIds(state.selectedNodeIds, state.nodes);
    const patches = ids
        .map((id) => {
            const n = state.nodes.find((node) => node.id === id);
            return n ? { id, patch: { x: (n.x ?? 0) + dx, y: (n.y ?? 0) + dy } } : null;
        })
        .filter(Boolean);
    if (patches.length) {
        recordNodesMutation(store, patches.map((p) => p.id), () => collabPatchNodes(patches));
    }
}

function reorderPageNodesByZ(pageNodes, selectedIds, mode) {
    const selectedSet = new Set(selectedIds);
    const ordered = [...pageNodes].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    const selected = ordered.filter((n) => selectedSet.has(n.id));
    if (!selected.length) return ordered;

    const rest = ordered.filter((n) => !selectedSet.has(n.id));
    const indices = ordered.map((n, i) => (selectedSet.has(n.id) ? i : -1)).filter((i) => i >= 0);
    const minI = Math.min(...indices);
    const maxI = Math.max(...indices);

    switch (mode) {
        case 'front':
            return [...rest, ...selected];
        case 'back':
            return [...selected, ...rest];
        case 'forward':
            if (maxI >= ordered.length - 1) return ordered;
            return [
                ...ordered.slice(0, minI),
                ordered[maxI + 1],
                ...ordered.slice(minI, maxI + 1),
                ...ordered.slice(maxI + 2),
            ];
        case 'backward':
            if (minI <= 0) return ordered;
            return [
                ...ordered.slice(0, minI - 1),
                ...ordered.slice(minI, maxI + 1),
                ordered[minI - 1],
                ...ordered.slice(maxI + 1),
            ];
        default:
            return ordered;
    }
}

/** @param {'forward'|'backward'|'front'|'back'} mode — front/back = extremo; forward/backward = um nível */
export function patchZIndexSelected(store, collabPatchNodes, mode) {
    const state = store.getState();
    const prunedIds = resolveDragNodeIds(state.selectedNodeIds, state.nodes);
    if (!prunedIds.length) return;

    const pageId = state.activePageId;
    const pageNodes = filterNodesByPage(state.nodes, pageId);
    const newOrdered = reorderPageNodesByZ(pageNodes, prunedIds, mode);

    const patches = newOrdered
        .map((n, i) => {
            if ((n.zIndex ?? 0) === i) return null;
            return { id: n.id, patch: { zIndex: i } };
        })
        .filter(Boolean);

    if (!patches.length) return;

    recordNodesMutation(store, patches.map((p) => p.id), () => {
        collabPatchNodes(patches);
    });
}
