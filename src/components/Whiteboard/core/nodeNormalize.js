/** Normaliza nós legados ao carregar/hidratar o documento. */
export function normalizeNode(node) {
    if (!node) return node;
    if (node.type === 'column') {
        return {
            ...node,
            type: 'frame',
            data: {
                ...(node.data || {}),
                title: node.data?.title || 'Coluna',
            },
        };
    }
    return node;
}

export function normalizeNodes(nodes) {
    if (!Array.isArray(nodes)) return [];
    return nodes.map(normalizeNode);
}
