import { uuidv4 } from '../../../../utils/uuid';
import { recordNodesMutation } from '../history/whiteboardHistory';
import { buildLayerTree, collectDescendantIds, isDescendantOf, pruneHierarchyIds } from '../layers/layerTreeUtils';
import { CONTAINER_NODE_TYPES } from '../../interaction/viewport/viewportUtils';
import { getNodePageId } from '../pages/whiteboardPages';
import { buildNodesById, nodeToWorld } from '../ops/whiteboardNodeOps';
import { normalizeFrameConstraints } from '../frame/frameConstraints.js';

/** ID lógico de grupo no canvas (não cria nó container). */
export const NODE_GROUP_KEY = 'nodeGroupId';
export const NODE_GROUP_NAME_KEY = 'nodeGroupName';
export const NODE_GROUP_PARENT_KEY = 'nodeGroupParentId';
export const VIRTUAL_GROUP_PREFIX = '__group__';

export function getNodeGroupId(node) {
    return node?.data?.[NODE_GROUP_KEY] ?? null;
}

export function getNodeGroupName(node) {
    return node?.data?.[NODE_GROUP_NAME_KEY] ?? 'Grupo';
}

export function getNodeGroupParentId(node) {
    return node?.data?.[NODE_GROUP_PARENT_KEY] ?? null;
}

/** Flags para o menu de contexto da seleção. */
export function getSelectionContextFlags(nodes, selectedIds) {
    const targetIds = expandIdsToNodeGroups(nodes, selectedIds ?? []);
    const canGroup = targetIds.length >= 2;
    const canUngroup = targetIds.some((id) => {
        const n = nodes.find((x) => x.id === id);
        return n && getNodeGroupId(n);
    });
    return { canGroup, canUngroup };
}

export function virtualGroupId(groupId) {
    return `${VIRTUAL_GROUP_PREFIX}${groupId}`;
}

export function parseVirtualGroupId(id) {
    if (!id?.startsWith(VIRTUAL_GROUP_PREFIX)) return null;
    return id.slice(VIRTUAL_GROUP_PREFIX.length);
}

export function isVirtualGroupRow(id) {
    return id?.startsWith(VIRTUAL_GROUP_PREFIX) ?? false;
}

export function getNodesInGroup(nodes, groupId) {
    if (!groupId) return [];
    return nodes.filter((n) => getNodeGroupId(n) === groupId);
}

export function getGroupMemberIds(nodes, groupId) {
    return getNodesInGroup(nodes, groupId).map((n) => n.id);
}

function getChildGroupIdsFor(nodes, parentGroupId) {
    const allGroupIds = [...new Set((nodes || []).map((n) => getNodeGroupId(n)).filter(Boolean))];
    return allGroupIds.filter((gid) =>
        getNodesInGroup(nodes, gid).some((n) => getNodeGroupParentId(n) === parentGroupId)
    );
}

export function getGroupMemberIdsDeep(nodes, groupId) {
    if (!groupId) return [];
    const visited = new Set();
    const queue = [groupId];
    const memberIds = new Set();
    while (queue.length > 0) {
        const gid = queue.shift();
        if (!gid || visited.has(gid)) continue;
        visited.add(gid);
        getGroupMemberIds(nodes, gid).forEach((id) => memberIds.add(id));
        getChildGroupIdsFor(nodes, gid).forEach((childGroupId) => {
            if (!visited.has(childGroupId)) queue.push(childGroupId);
        });
    }
    return [...memberIds];
}

export function getGroupDisplayName(nodes, groupId) {
    const first = getNodesInGroup(nodes, groupId)[0];
    return first ? getNodeGroupName(first) : 'Grupo';
}

/** Inclui todos os membros dos grupos representados em ids. */
export function expandIdsToNodeGroups(nodes, ids) {
    const expanded = new Set(ids);
    for (const id of ids) {
        if (isVirtualGroupRow(id)) {
            const gid = parseVirtualGroupId(id);
            if (gid) getGroupMemberIdsDeep(nodes, gid).forEach((mid) => expanded.add(mid));
            continue;
        }
        const node = nodes.find((n) => n.id === id);
        const gid = getNodeGroupId(node);
        if (gid) {
            getGroupMemberIdsDeep(nodes, gid).forEach((mid) => expanded.add(mid));
        }
    }
    return [...expanded];
}

function patchDataGroup(node, groupId, groupName, { parentGroupId = null, clearParent = false } = {}) {
    const data = { ...(node.data || {}) };
    if (groupId) {
        data[NODE_GROUP_KEY] = groupId;
        data[NODE_GROUP_NAME_KEY] = groupName ?? data[NODE_GROUP_NAME_KEY] ?? 'Grupo';
        if (parentGroupId) {
            data[NODE_GROUP_PARENT_KEY] = parentGroupId;
        } else if (clearParent) {
            delete data[NODE_GROUP_PARENT_KEY];
        }
    } else {
        delete data[NODE_GROUP_KEY];
        delete data[NODE_GROUP_NAME_KEY];
        delete data[NODE_GROUP_PARENT_KEY];
    }
    return { data };
}

export function wouldCreateGroupCycle(nodes, childGroupId, parentGroupId) {
    if (!childGroupId || !parentGroupId || childGroupId === parentGroupId) return true;
    let pid = parentGroupId;
    const visited = new Set();
    while (pid) {
        if (pid === childGroupId) return true;
        if (visited.has(pid)) break;
        visited.add(pid);
        const member = nodes.find((n) => getNodeGroupId(n) === pid);
        pid = member ? getNodeGroupParentId(member) : null;
    }
    return false;
}

/**
 * Clique no canvas:
 * - Normal → grupo inteiro
 * - Shift → adiciona/remove o grupo da seleção (multi-select)
 * - Ctrl → só este item (dentro do grupo)
 */
export function resolveNodeClickSelection(nodeId, nodes, selectedIds, modifiers = {}) {
    const { shiftKey = false, ctrlKey = false } = modifiers;
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return selectedIds;

    const isSelected = selectedIds.includes(nodeId);
    const groupId = getNodeGroupId(node);
    const memberIds = groupId ? getGroupMemberIdsDeep(nodes, groupId) : [nodeId];

    if (ctrlKey) {
        if (isSelected) return selectedIds.filter((id) => id !== nodeId);
        return [...selectedIds, nodeId];
    }

    if (shiftKey) {
        const toggleIds = groupId ? memberIds : [nodeId];
        const allIn = toggleIds.every((id) => selectedIds.includes(id));
        if (allIn) {
            return selectedIds.filter((id) => !toggleIds.includes(id));
        }
        return [...new Set([...selectedIds, ...toggleIds])];
    }

    if (!groupId) {
        return isSelected ? selectedIds : [nodeId];
    }

    const allMembersSelected =
        memberIds.length > 0 && memberIds.every((id) => selectedIds.includes(id));

    if (isSelected && allMembersSelected) {
        return selectedIds;
    }

    return memberIds;
}

/** Seleção na lista de camadas (inclui linha virtual do grupo). */
export function resolveLayerClickSelection(rowId, nodes, selectedIds, modifiers = {}) {
    if (!isVirtualGroupRow(rowId)) {
        return resolveNodeClickSelection(rowId, nodes, selectedIds, modifiers);
    }

    const groupId = parseVirtualGroupId(rowId);
    const memberIds = getGroupMemberIdsDeep(nodes, groupId);
    const { shiftKey = false, ctrlKey = false } = modifiers;

    if (ctrlKey) {
        return memberIds.length ? [memberIds[0]] : selectedIds;
    }

    if (shiftKey) {
        const allIn = memberIds.every((id) => selectedIds.includes(id));
        if (allIn) {
            return selectedIds.filter((id) => !memberIds.includes(id));
        }
        return [...new Set([...selectedIds, ...memberIds])];
    }

    return memberIds;
}

/**
 * Agrupa seleção (Ctrl+G): mesma nodeGroupId, sem frame.
 */
/** IDs que recebem nodeGroupId ao agrupar (inclui filhos de containers selecionados). */
export function collectIdsForGrouping(nodes, selectedIds) {
    const expanded = expandIdsToNodeGroups(nodes, selectedIds);
    const topLevelIds = pruneHierarchyIds(expanded, nodes);
    const ids = new Set(topLevelIds);
    for (const id of topLevelIds) {
        const node = nodes.find((n) => n.id === id);
        if (node && CONTAINER_NODE_TYPES.includes(node.type)) {
            collectDescendantIds(id, nodes).forEach((cid) => ids.add(cid));
        }
    }
    return [...ids];
}

export function groupSelectedNodes(store, collabPatchNodes) {
    const state = store.getState();
    const idsToGroup = collectIdsForGrouping(state.nodes, state.selectedNodeIds);
    const toPatch = state.nodes.filter((n) => idsToGroup.includes(n.id));
    if (toPatch.length < 2) return null;

    const newGroupId = uuidv4();
    const groupName = 'Grupo';
    const selectedGroupIds = new Set();
    for (const id of state.selectedNodeIds ?? []) {
        const n = state.nodes.find((node) => node.id === id);
        const gid = getNodeGroupId(n);
        if (gid) selectedGroupIds.add(gid);
    }
    const patches = toPatch.map((n) => {
        const currentGroupId = getNodeGroupId(n);
        if (currentGroupId && selectedGroupIds.has(currentGroupId)) {
            return {
                id: n.id,
                patch: patchDataGroup(n, currentGroupId, getNodeGroupName(n), {
                    parentGroupId: newGroupId,
                }),
            };
        }
        return {
            id: n.id,
            patch: patchDataGroup(n, newGroupId, groupName, { clearParent: true }),
        };
    });

    recordNodesMutation(store, patches.map((p) => p.id), () => {
        collabPatchNodes(patches);
    });

    state.setSelection(idsToGroup);
    return newGroupId;
}

export function renameNodeGroup(store, collabPatchNodes, groupId, name) {
    const trimmed = String(name ?? '').trim();
    if (!trimmed || !groupId) return false;

    const state = store.getState();
    const members = getNodesInGroup(state.nodes, groupId);
    if (!members.length) return false;

    const patches = members.map((n) => ({
        id: n.id,
        patch: patchDataGroup(n, groupId, trimmed),
    }));

    recordNodesMutation(store, patches.map((p) => p.id), () => {
        collabPatchNodes(patches);
    });
    return true;
}

/**
 * Desagrupa (Ctrl+Shift+G): remove nodeGroupId dos grupos afetados.
 */
export function ungroupSelectedNodes(store, collabPatchNodes, collabDeleteNodes) {
    const state = store.getState();
    const selected = state.nodes.filter((n) => state.selectedNodeIds.includes(n.id));

    const groupIds = new Set();
    for (const n of selected) {
        const gid = getNodeGroupId(n);
        if (gid) groupIds.add(gid);
    }

    const patches = [];
    for (const gid of groupIds) {
        for (const n of getNodesInGroup(state.nodes, gid)) {
            patches.push({ id: n.id, patch: patchDataGroup(n, null) });
        }
    }

    const legacyFrames = selected.filter((n) => n.type === 'frame' && n.data?.isGroup);
    const legacyPatches = [];
    for (const frame of legacyFrames) {
        for (const child of state.nodes.filter((n) => n.parentId === frame.id)) {
            legacyPatches.push({
                id: child.id,
                patch: { parentId: null, x: frame.x + (child.x ?? 0), y: frame.y + (child.y ?? 0) },
            });
        }
    }

    const allPatches = [...patches, ...legacyPatches];
    if (!allPatches.length && !legacyFrames.length) return false;

    if (allPatches.length) {
        recordNodesMutation(store, allPatches.map((p) => p.id), () => {
            collabPatchNodes(allPatches);
        });
    }

    if (legacyFrames.length && collabDeleteNodes) {
        const deleteIds = legacyFrames.map((f) => f.id);
        store.getState().pushHistory({
            type: 'node_delete',
            payload: {
                nodes: legacyFrames.map((n) => JSON.parse(JSON.stringify(n))),
            },
        });
        collabDeleteNodes(deleteIds);
        store.getState().setSelection(
            store.getState().selectedNodeIds.filter((id) => !deleteIds.includes(id))
        );
    }

    return true;
}

/** Aninha um grupo lógico dentro de outro (camadas ou arraste). */
export function nestGroupInParent(store, collabPatchNodes, childGroupId, parentGroupId) {
    const state = store.getState();
    if (!childGroupId || !parentGroupId || childGroupId === parentGroupId) return false;
    if (wouldCreateGroupCycle(state.nodes, childGroupId, parentGroupId)) return false;

    const members = getNodesInGroup(state.nodes, childGroupId);
    if (!members.length) return false;

    const patches = members.map((n) => ({
        id: n.id,
        patch: patchDataGroup(n, getNodeGroupId(n), getNodeGroupName(n), { parentGroupId }),
    }));

    recordNodesMutation(store, patches.map((p) => p.id), () => {
        collabPatchNodes(patches);
    });
    return true;
}

/** Adiciona um nó a um grupo lógico (painel de camadas). */
export function assignNodeToLogicalGroup(store, collabPatchNodes, nodeId, targetGroupId) {
    const state = store.getState();
    const node = state.nodes.find((n) => n.id === nodeId);
    if (!node || !targetGroupId || isVirtualGroupRow(nodeId)) return false;

    const members = getNodesInGroup(state.nodes, targetGroupId);
    if (!members.length) return false;

    const parentGroupId = getNodeGroupParentId(members[0]);
    const groupName = getGroupDisplayName(state.nodes, targetGroupId);

    const patches = [
        {
            id: nodeId,
            patch: patchDataGroup(node, targetGroupId, groupName, {
                parentGroupId: parentGroupId || undefined,
                clearParent: !parentGroupId,
            }),
        },
    ];

    recordNodesMutation(store, [nodeId], () => {
        collabPatchNodes(patches);
    });
    return true;
}

/** Destino válido para soltar “dentro” na lista de camadas. */
export function canNestLayerTarget(dragId, targetId, nodes) {
    if (!dragId || !targetId || dragId === targetId) return false;
    if (isVirtualGroupRow(targetId)) {
        if (isVirtualGroupRow(dragId)) {
            const childG = parseVirtualGroupId(dragId);
            const parentG = parseVirtualGroupId(targetId);
            return !!(childG && parentG && !wouldCreateGroupCycle(nodes, childG, parentG));
        }
        return true;
    }
    const target = nodes.find((n) => n.id === targetId);
    if (!target || !CONTAINER_NODE_TYPES.includes(target.type)) return false;
    if (isVirtualGroupRow(dragId)) return true;
    return !isDescendantOf(dragId, targetId, nodes);
}

export function nestLogicalGroupInContainer(store, collabPatchNodes, groupId, containerId) {
    const state = store.getState();
    const container = state.nodes.find((n) => n.id === containerId);
    const memberIdSet = new Set(getGroupMemberIdsDeep(state.nodes, groupId));
    const members = state.nodes.filter((n) => memberIdSet.has(n.id));
    if (!container || !CONTAINER_NODE_TYPES.includes(container.type) || !members.length) return false;
    const byId = buildNodesById(state.nodes);
    const containerWorld = nodeToWorld(container, byId);
    const blocked = members.some((n) => isDescendantOf(containerId, n.id, state.nodes));
    if (blocked) return false;
    const patches = members.map((member) => {
        const world = nodeToWorld(member, byId);
        const patch = {
            parentId: containerId,
            x: world.x - containerWorld.x,
            y: world.y - containerWorld.y,
        };
        if (container.type === 'frame') {
            patch.data = {
                ...(member.data || {}),
                constraints: normalizeFrameConstraints(member.data?.constraints),
            };
        }
        return {
            id: member.id,
            patch,
        };
    });
    recordNodesMutation(store, patches.map((p) => p.id), () => {
        collabPatchNodes(patches);
    });
    return true;
}

export function unnestLogicalGroupToRoot(store, collabPatchNodes, groupId) {
    const state = store.getState();
    const memberIdSet = new Set(getGroupMemberIdsDeep(state.nodes, groupId));
    const members = state.nodes
        .filter((n) => memberIdSet.has(n.id))
        .filter((n) => n.parentId);
    if (!members.length) return false;
    const byId = buildNodesById(state.nodes);
    const patches = members.map((member) => {
        const world = nodeToWorld(member, byId);
        return {
            id: member.id,
            patch: {
                parentId: null,
                x: world.x,
                y: world.y,
            },
        };
    });
    recordNodesMutation(store, patches.map((p) => p.id), () => {
        collabPatchNodes(patches);
    });
    return true;
}

export function ungroupByGroupId(store, collabPatchNodes, groupId) {
    const state = store.getState();
    const members = getNodesInGroup(state.nodes, groupId);
    if (!members.length) return false;

    const patches = members.map((n) => ({
        id: n.id,
        patch: patchDataGroup(n, null),
    }));

    recordNodesMutation(store, patches.map((p) => p.id), () => {
        collabPatchNodes(patches);
    });
    return true;
}

function attachNodeChildren(node, pageNodes) {
    const kids = pageNodes
        .filter((n) => n.parentId === node.id)
        .sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));
    return kids.map((k) => ({
        ...k,
        _children: attachNodeChildren(k, pageNodes),
    }));
}

function collectGroupIds(pageNodes) {
    return [...new Set(pageNodes.map((n) => getNodeGroupId(n)).filter(Boolean))];
}

function getChildGroupIds(pageNodes, parentGroupId) {
    const all = collectGroupIds(pageNodes);
    return all.filter((gid) =>
        getNodesInGroup(pageNodes, gid).some((n) => getNodeGroupParentId(n) === parentGroupId)
    );
}

function buildVirtualGroupNode(groupId, pageNodes) {
    const members = getNodesInGroup(pageNodes, groupId);
    const childGroupIds = getChildGroupIds(pageNodes, groupId).sort((a, b) => {
        const za = Math.max(0, ...getNodesInGroup(pageNodes, a).map((m) => m.zIndex ?? 0));
        const zb = Math.max(0, ...getNodesInGroup(pageNodes, b).map((m) => m.zIndex ?? 0));
        return zb - za;
    });
    const nestedMemberIds = new Set();
    childGroupIds.forEach((cid) => {
        getGroupMemberIds(pageNodes, cid).forEach((id) => nestedMemberIds.add(id));
    });
    const directMembers = members
        .filter((m) => !nestedMemberIds.has(m.id))
        .sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0))
        .map((m) => ({
            ...m,
            _children: attachNodeChildren(m, pageNodes),
        }));

    const childVirtuals = childGroupIds.map((cid) => buildVirtualGroupNode(cid, pageNodes));
    const maxZ = Math.max(
        0,
        ...members.map((m) => m.zIndex ?? 0),
        ...childVirtuals.map((v) => v.zIndex ?? 0)
    );

    return {
        id: virtualGroupId(groupId),
        _isVirtualGroup: true,
        _nodeGroupId: groupId,
        type: 'group',
        zIndex: maxZ,
        data: { nodeGroupName: getGroupDisplayName(pageNodes, groupId) },
        _children: [...childVirtuals, ...directMembers],
    };
}

/** Árvore de camadas com grupos aninhados (renomeáveis). */
export function buildLayerTreeWithGroups(nodes, pageId) {
    const pageNodes = (nodes ?? []).filter((n) => getNodePageId(n) === pageId);
    const allGroupIds = collectGroupIds(pageNodes);
    const rootGroupIds = allGroupIds.filter((gid) => {
        const parent = getNodeGroupParentId(getNodesInGroup(pageNodes, gid)[0]);
        return !parent || !allGroupIds.includes(parent);
    });

    const virtualGroups = rootGroupIds
        .map((gid) => buildVirtualGroupNode(gid, pageNodes))
        .sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));

    const ungroupedForHierarchy = pageNodes.filter((n) => !getNodeGroupId(n));
    const hierarchyRoots = buildLayerTree(ungroupedForHierarchy, pageId);

    return [...virtualGroups, ...hierarchyRoots];
}

/** Após duplicar/colar vários nós do mesmo grupo, atribui novo nodeGroupId. */
export function assignFreshGroupIdToClones(createdNodes) {
    if (!createdNodes?.length) return;
    const srcIds = new Set(createdNodes.map((n) => getNodeGroupId(n)).filter(Boolean));
    if (createdNodes.length < 2 || srcIds.size !== 1) {
        for (const n of createdNodes) {
            if (n.data?.[NODE_GROUP_KEY]) {
                delete n.data[NODE_GROUP_KEY];
                delete n.data[NODE_GROUP_NAME_KEY];
                delete n.data[NODE_GROUP_PARENT_KEY];
            }
        }
        return;
    }
    const newGid = uuidv4();
    const name = getNodeGroupName(createdNodes[0]);
    for (const n of createdNodes) {
        n.data = {
            ...(n.data || {}),
            [NODE_GROUP_KEY]: newGid,
            [NODE_GROUP_NAME_KEY]: name,
        };
        delete n.data[NODE_GROUP_PARENT_KEY];
    }
}
