import { pruneHierarchyIds } from './layerTreeUtils';
import { expandIdsToNodeGroups } from './whiteboardGroupOps';

/** @deprecated Use pruneHierarchyIds — mantido para imports existentes. */
export const pruneNestedDragIds = pruneHierarchyIds;

/** Expande para membros do grupo lógico e remove aninhamento duplicado (frames). */
export function resolveDragNodeIds(ids, nodes) {
    const expanded = expandIdsToNodeGroups(nodes, ids);
    return pruneHierarchyIds(expanded, nodes);
}
