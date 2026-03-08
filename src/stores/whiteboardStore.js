import { create } from 'zustand';

const MAX_HISTORY = 100;

export function createHistoryEntry(type, payload) {
    return { type, payload, timestamp: Date.now() };
}

const CREATION_TOOLS = ['sticky_note', 'text', 'shape', 'frame', 'link', 'todo_list', 'column', 'table', 'connector', 'comment', 'draw', 'image', 'file'];

export function getDefaultNodePayload(type, x, y) {
    const id = crypto.randomUUID();
    const base = { id, x, y, rotation: 0, scale: 1, parentId: null, zIndex: 0 };
    const defaults = {
        sticky_note: { type: 'sticky_note', width: 150, height: 100, data: { text: '' }, style: { backgroundColor: '#fef08a' } },
        text: { type: 'text', width: 200, height: 40, data: { text: 'Text' }, style: {} },
        shape: { type: 'shape', width: 100, height: 100, data: { shape: 'rectangle' }, style: { fill: 'var(--bg-elevated)', stroke: 'var(--border-color)' } },
        frame: { type: 'frame', width: 300, height: 200, data: { title: 'Frame' }, style: {} },
        link: { type: 'link', width: 240, height: 80, data: { url: '', title: '' }, style: {} },
        todo_list: { type: 'todo_list', width: 220, height: 120, data: { items: [{ id: crypto.randomUUID(), text: 'Item', done: false }] }, style: {} },
        column: { type: 'column', width: 200, height: 200, data: { title: '' }, style: {} },
        table: { type: 'table', width: 280, height: 120, data: { rows: [], cols: [] }, style: {} },
        connector: { type: 'connector', width: 0, height: 0, data: {}, style: {} },
        comment: { type: 'comment', width: 200, height: 80, data: { message: '' }, style: {} },
        draw: { type: 'draw', width: 200, height: 150, data: { paths: [] }, style: { stroke: '#000' } },
        image: { type: 'image', width: 200, height: 150, data: { url: '' }, style: {} },
        file: { type: 'file_card', width: 220, height: 80, data: { url: '', filename: '', size: '' }, style: {} },
    };
    const d = defaults[type] || defaults.sticky_note;
    return { ...base, ...d };
}

export function isCreationTool(tool) {
    return tool && tool !== 'select' && CREATION_TOOLS.includes(tool);
}

const GRID_STORAGE_KEY = 'dailyways_grid_visible';
function loadGridVisible() {
    return true;
}

export const useWhiteboardStore = create((set, get) => ({
    spaceId: null,
    nodes: [],
    connectors: [],
    comments: [],
    selectedNodeIds: [],
    activeTool: 'select',
    connectorFromNodeId: null,
    viewport: { panX: 0, panY: 0, zoom: 1 },
    gridVisible: loadGridVisible(),
    lastCreatedNodeId: null,
    dirtyNodeIds: [],
    history: [],
    historyIndex: -1,
    suppressRealtimeUntil: 0,

    setSpaceId: (spaceId) => set({
        spaceId,
        nodes: [],
        connectors: [],
        comments: [],
        selectedNodeIds: [],
        activeTool: 'select',
        connectorFromNodeId: null,
        editingNodeId: null,
        dirtyNodeIds: [],
        history: [],
        historyIndex: -1,
    }),

    setActiveTool: (activeTool) => set({ activeTool }),
    setConnectorFromNodeId: (connectorFromNodeId) => set({ connectorFromNodeId: connectorFromNodeId ?? null }),
    editingNodeId: null,
    setEditingNodeId: (editingNodeId) => set({ editingNodeId: editingNodeId ?? null }),

    setNodes: (nodes) => set({ nodes: nodes ?? [] }),
    setConnectors: (connectors) => set({ connectors: connectors ?? [] }),
    setComments: (comments) => set({ comments: comments ?? [] }),

    setViewport: (viewport) => set((state) => ({
        viewport: { ...state.viewport, ...viewport },
    })),

    setGridVisible: (gridVisible) => {
        try {
            localStorage.setItem(GRID_STORAGE_KEY, gridVisible ? 'true' : 'false');
        } catch {}
        set({ gridVisible });
    },

    setSelection: (selectedNodeIds) => set({
        selectedNodeIds: Array.isArray(selectedNodeIds) ? selectedNodeIds : [],
    }),

    setLastCreatedNodeId: (id) => set({ lastCreatedNodeId: id ?? null }),

    addNode: (node) => set((state) => ({
        nodes: [...state.nodes, node],
    })),

    patchNode: (nodeId, patch) => set((state) => {
        const idx = state.nodes.findIndex((n) => n.id === nodeId);
        if (idx < 0) return state;
        const next = [...state.nodes];
        next[idx] = { ...next[idx], ...patch };
        return {
            nodes: next,
            dirtyNodeIds: state.dirtyNodeIds.includes(nodeId)
                ? state.dirtyNodeIds
                : [...state.dirtyNodeIds, nodeId],
        };
    }),

    patchNodes: (patches) => set((state) => {
        const byId = new Map(patches.map((p) => [p.id, p.patch]));
        const next = state.nodes.map((n) =>
            byId.has(n.id) ? { ...n, ...byId.get(n.id) } : n
        );
        const dirty = [...new Set([...state.dirtyNodeIds, ...patches.map((p) => p.id)])];
        return { nodes: next, dirtyNodeIds: dirty };
    }),

    deleteNodes: (ids) => set((state) => {
        const setIds = new Set(ids);
        return {
            nodes: state.nodes.filter((n) => !setIds.has(n.id)),
            selectedNodeIds: state.selectedNodeIds.filter((id) => !setIds.has(id)),
            dirtyNodeIds: state.dirtyNodeIds.filter((id) => !setIds.has(id)),
        };
    }),

    addConnector: (connector) => set((state) => ({
        connectors: [...state.connectors, connector],
    })),

    patchConnector: (connectorId, patch) => set((state) => {
        const idx = state.connectors.findIndex((c) => c.id === connectorId);
        if (idx < 0) return state;
        const next = [...state.connectors];
        next[idx] = { ...next[idx], ...patch };
        return { connectors: next };
    }),

    deleteConnector: (connectorId) => set((state) => ({
        connectors: state.connectors.filter((c) => c.id !== connectorId),
    })),

    addComment: (comment) => set((state) => ({
        comments: [...state.comments, comment],
    })),

    markNodeDirty: (nodeId) => set((state) => ({
        dirtyNodeIds: state.dirtyNodeIds.includes(nodeId)
            ? state.dirtyNodeIds
            : [...state.dirtyNodeIds, nodeId],
    })),

    clearDirty: (nodeIds = null) => set((state) => ({
        dirtyNodeIds: nodeIds == null ? [] : state.dirtyNodeIds.filter((id) => !nodeIds.includes(id)),
    })),

    getDirtyNodes: () => {
        const state = get();
        return state.nodes.filter((n) => state.dirtyNodeIds.includes(n.id));
    },

    pushHistory: (entry) => set((state) => {
        const history = state.history.slice(0, state.historyIndex + 1);
        history.push(entry);
        if (history.length > MAX_HISTORY) history.shift();
        return { history, historyIndex: history.length - 1 };
    }),

    undo: () => set((state) => {
        if (state.historyIndex < 0) return state;
        const entry = state.history[state.historyIndex];
        const nextIndex = state.historyIndex - 1;
        const nextNodes = state.nodes.map((n) => {
            if (entry.type === 'node_move' && entry.payload.before && n.id === entry.payload.id)
                return { ...n, x: entry.payload.before.x, y: entry.payload.before.y };
            if (entry.type === 'node_resize' && entry.payload.before && n.id === entry.payload.id)
                return { ...n, ...entry.payload.before };
            if (entry.type === 'node_edit' && entry.payload.before && n.id === entry.payload.id)
                return { ...n, ...entry.payload.before };
            if (entry.type === 'node_delete' && entry.payload.node?.id === n.id)
                return entry.payload.node;
            return n;
        });
        const nodes =
            entry.type === 'node_delete' && entry.payload.node
                ? [...nextNodes.filter((n) => n.id !== entry.payload.node.id), entry.payload.node]
                : nextNodes;
        return { nodes, historyIndex: nextIndex };
    }),

    redo: () => set((state) => {
        if (state.historyIndex >= state.history.length - 1) return state;
        const nextIndex = state.historyIndex + 1;
        const entry = state.history[nextIndex];
        const nextNodes = state.nodes.map((n) => {
            if (entry.type === 'node_move' && entry.payload.after && n.id === entry.payload.id)
                return { ...n, x: entry.payload.after.x, y: entry.payload.after.y };
            if (entry.type === 'node_resize' && entry.payload.after && n.id === entry.payload.id)
                return { ...n, ...entry.payload.after };
            if (entry.type === 'node_edit' && entry.payload.after && n.id === entry.payload.id)
                return { ...n, ...entry.payload.after };
            if (entry.type === 'node_add' && entry.payload.node?.id === n.id)
                return entry.payload.node;
            return n;
        });
        const nodes =
            entry.type === 'node_add' && entry.payload.node
                ? [...state.nodes.filter((n) => n.id !== entry.payload.node.id), entry.payload.node]
                : nextNodes;
        return { nodes, historyIndex: nextIndex };
    }),

    canUndo: () => get().historyIndex >= 0,
    canRedo: () => {
        const s = get();
        return s.historyIndex < s.history.length - 1;
    },

    setSuppressRealtimeUntil: (ms) => set({
        suppressRealtimeUntil: Date.now() + (ms || 0),
    }),

    mergeNodesFromServer: (serverNodes) => set((state) => {
        if (!serverNodes?.length) return state;
        const byId = new Map(state.nodes.map((n) => [n.id, n]));
        for (const n of serverNodes) {
            if (state.dirtyNodeIds.includes(n.id)) continue;
            byId.set(n.id, n);
        }
        return { nodes: Array.from(byId.values()) };
    }),

    mergeConnectorsFromServer: (serverConnectors) => set({
        connectors: serverConnectors ?? [],
    }),

    mergeCommentsFromServer: (serverComments) => set({
        comments: serverComments ?? [],
    }),
}));
