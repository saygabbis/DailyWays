import { pruneHierarchyIds } from '../layers/layerTreeUtils';
import { expandIdsToNodeGroups } from '../layers/whiteboardGroupOps';

/** @deprecated Use pruneHierarchyIds — mantido para imports existentes. */
export const pruneNestedDragIds = pruneHierarchyIds;

/** Expande para membros do grupo lógico e remove aninhamento duplicado (frames). */
export function resolveDragNodeIds(ids, nodes) {
    const expanded = expandIdsToNodeGroups(nodes, ids);
    return pruneHierarchyIds(expanded, nodes);
}
