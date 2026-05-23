import { CONTAINER_NODE_TYPES } from './viewportUtils';
import { getNodePageId } from './whiteboardPages';

export function buildLayerTree(nodes, pageId) {
    const pageNodes = (nodes ?? []).filter((n) => getNodePageId(n) === pageId);
    const byParent = new Map();
    for (const n of pageNodes) {
        const pid = n.parentId ?? '__root__';
        if (!byParent.has(pid)) byParent.set(pid, []);
        byParent.get(pid).push(n);
    }
    const attach = (list) =>
        list
            .sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0))
            .map((n) => ({
                ...n,
                _children: attach(byParent.get(n.id) || []),
            }));
    return attach(byParent.get('__root__') || []);
}

export function collectDescendantIds(nodeId, nodes) {
    const ids = [];
    const walk = (pid) => {
        for (const n of nodes) {
            if (n.parentId === pid) {
                ids.push(n.id);
                walk(n.id);
            }
        }
    };
    walk(nodeId);
    return ids;
}

export function isDescendantOf(ancestorId, nodeId, nodes) {
    let pid = nodes.find((n) => n.id === nodeId)?.parentId;
    while (pid) {
        if (pid === ancestorId) return true;
        pid = nodes.find((n) => n.id === pid)?.parentId;
    }
    return false;
}

/** Remove ids cujo ancestral também está na lista (evita duplo arraste/transform). */
export function pruneHierarchyIds(ids, nodes) {
    const list = ids ?? [];
    return list.filter(
        (id) => !list.some((otherId) => otherId !== id && isDescendantOf(otherId, id, nodes))
    );
}

export function canNestInside(dragId, targetId, nodes) {
    if (!dragId || !targetId || dragId === targetId) return false;
    if (isDescendantOf(dragId, targetId, nodes)) return false;
    const target = nodes.find((n) => n.id === targetId);
    return target && CONTAINER_NODE_TYPES.includes(target.type);
}

export function layerDisplayName(node) {
    if (node._isVirtualGroup || node.type === 'group') {
        return String(node.data?.nodeGroupName || 'Grupo').slice(0, 48);
    }
    if (node.data?.layerName) return String(node.data.layerName).slice(0, 48);
    if (node.type === 'text' || node.type === 'sticky_note') {
        const t = node.data?.text ?? '';
        if (t && String(t).trim()) return String(t).trim().slice(0, 40);
    }
    if (node.type === 'frame') return node.data?.title || 'Frame';
    const labels = {
        shape: 'Forma',
        text: 'Texto',
        sticky_note: 'Nota',
        frame: 'Frame',
        link: 'Link',
        todo_list: 'To-do',
        column: 'Coluna',
        table: 'Tabela',
        comment: 'Comentário',
        image: 'Imagem',
        file_card: 'Arquivo',
        drawing: 'Desenho',
        draw: 'Desenho',
    };
    return labels[node.type] || node.type || 'Elemento';
}

export function renamePatchForNode(node, name) {
    const trimmed = String(name ?? '').trim();
    if (!trimmed) return null;
    if (node._isVirtualGroup || node.type === 'group') {
        return { _renameGroupId: node._nodeGroupId, _groupName: trimmed };
    }
    if (node.type === 'frame') {
        return { data: { ...node.data, title: trimmed, layerName: trimmed } };
    }
    if (node.type === 'text' || node.type === 'sticky_note') {
        return { data: { ...node.data, text: trimmed, layerName: trimmed } };
    }
    return { data: { ...node.data, layerName: trimmed } };
}
