import { pruneHierarchyIds } from '../layers/layerTreeUtils';
import { expandIdsToNodeGroups } from '../layers/whiteboardGroupOps';
import { filterNodesByPage } from '../pages/whiteboardPages';
import { buildNodesById, nodeToWorld, worldTopLeftToNodePatch } from '../ops/whiteboardNodeOps';
import { rectIntersects } from '../../interaction/viewport/viewportUtils';

/** @deprecated Use pruneHierarchyIds — mantido para imports existentes. */
export const pruneNestedDragIds = pruneHierarchyIds;

/** Expande grupos lógicos salvo drill-down ou seleção isolada (Ctrl). */
export function shouldExpandSelectionGroups({ groupDrill = null, isolateSelection = false } = {}) {
    return !groupDrill && !isolateSelection;
}

/**
 * IDs efetivos para arraste/resize/transform.
 * @param {{ expandGroups?: boolean }} options — false com drill-down ou isolateSelection (Ctrl).
 */
export function resolveDragNodeIds(ids, nodes, options = {}) {
    const expandGroups =
        options.expandGroups ??
        shouldExpandSelectionGroups(options);
    const list = expandGroups ? expandIdsToNodeGroups(nodes, ids) : [...(ids ?? [])];
    return pruneHierarchyIds(list, nodes);
}

function nodeWorldRect(node, byId) {
    const world = nodeToWorld(node, byId);
    return {
        x: world.x,
        y: world.y,
        width: node.width ?? 0,
        height: node.height ?? 0,
    };
}

function rectFullyContains(outer, inner) {
    return (
        inner.x >= outer.x &&
        inner.y >= outer.y &&
        inner.x + inner.width <= outer.x + outer.width &&
        inner.y + inner.height <= outer.y + outer.height
    );
}

function isDescendantOf(node, ancestorId, byId) {
    let parentId = node.parentId;
    while (parentId) {
        if (parentId === ancestorId) return true;
        parentId = byId[parentId]?.parentId;
    }
    return false;
}

/**
 * Seleção por marquee estilo Figma para frames:
 * - frame só entra se a caixa cobrir o frame por completo;
 * - interseção parcial seleciona filhos (não o frame).
 */
export function resolveMarqueeSelectionIds(nodes, box, pageId) {
    const pageNodes = filterNodesByPage(nodes, pageId);
    const byId = buildNodesById(pageNodes);
    const fullySelectedFrameIds = new Set();

    for (const node of pageNodes) {
        if (node.type !== 'frame') continue;
        const worldRect = nodeWorldRect(node, byId);
        if (rectFullyContains(box, worldRect)) {
            fullySelectedFrameIds.add(node.id);
        }
    }

    const isUnderFullySelectedFrame = (node) => {
        for (const frameId of fullySelectedFrameIds) {
            if (node.id === frameId || isDescendantOf(node, frameId, byId)) return true;
        }
        return false;
    };

    const hitIds = [...fullySelectedFrameIds];

    for (const node of pageNodes) {
        if (isUnderFullySelectedFrame(node)) continue;
        const worldRect = nodeWorldRect(node, byId);
        if (!rectIntersects(box, worldRect)) continue;
        if (node.type === 'frame' && !fullySelectedFrameIds.has(node.id)) continue;
        hitIds.push(node.id);
    }

    return resolveDragNodeIds(hitIds, nodes);
}

/** Converte delta de arraste (mundo) em patches locais para cada nó. */
export function buildDragFinishPatches(ids, beforeSnapshots, offset, allNodes) {
    const byId = buildNodesById(allNodes);
    return ids
        .map((id) => {
            const initial = beforeSnapshots?.find((b) => b.id === id)?.node;
            if (!initial) return null;
            const current = allNodes.find((n) => n.id === id) ?? initial;
            const worldInitial = nodeToWorld(initial, byId);
            const patch = worldTopLeftToNodePatch(
                current,
                worldInitial.x + (offset?.dx ?? 0),
                worldInitial.y + (offset?.dy ?? 0),
                allNodes
            );
            return { id, patch };
        })
        .filter(Boolean);
}
