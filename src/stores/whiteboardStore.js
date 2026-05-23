import { create } from 'zustand';
import { uuidv4 } from '../utils/uuid';
import {
    loadSpacePages,
    saveSpacePages,
    createPageEntry,
    newPageName,
    DEFAULT_PAGE_ID,
    filterNodesByPage,
} from '../components/Whiteboard/whiteboardPages';

const MAX_HISTORY = 600;

export function createHistoryEntry(type, payload) {
    return { type, payload, timestamp: Date.now() };
}

const CREATION_TOOLS = ['sticky_note', 'text', 'shape', 'frame', 'link', 'todo_list', 'column', 'table', 'connector', 'comment', 'draw', 'image', 'file'];

export function getDefaultNodePayload(type, x, y) {
    const id = uuidv4();
    const base = { id, x, y, rotation: 0, scale: 1, parentId: null, zIndex: 0 };
    const defaults = {
        sticky_note: {
            type: 'sticky_note',
            width: 150,
            height: 100,
            data: { text: '' },
            style: { backgroundColor: '#fef08a', color: '#111827' },
        },
        text: { type: 'text', width: 200, height: 40, data: { text: 'Text' }, style: {} },
        shape: { type: 'shape', width: 100, height: 100, data: { shape: 'rectangle' }, style: { fill: 'var(--bg-elevated)', stroke: 'var(--border-color)' } },
        frame: { type: 'frame', width: 300, height: 200, data: { title: 'Frame' }, style: {} },
        link: { type: 'link', width: 240, height: 80, data: { url: '', title: '' }, style: {} },
        todo_list: { type: 'todo_list', width: 220, height: 120, data: { items: [{ id: uuidv4(), text: 'Item', done: false }] }, style: {} },
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
const RULERS_STORAGE_KEY = 'dailyways_rulers_visible';
const INSPECTOR_PANEL_KEY = 'dailyways_inspector_panel_open';
const PROPS_PANEL_KEY = 'dailyways_props_panel_open';
const INSPECTOR_TAB_KEY = 'dailyways_inspector_tab';

function loadBool(key, defaultValue) {
    try {
        const v = localStorage.getItem(key);
        if (v === null) return defaultValue;
        return v === 'true';
    } catch {
        return defaultValue;
    }
}

function loadGridVisible() {
    return true;
}

function loadRulersVisible() {
    try {
        return localStorage.getItem(RULERS_STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
}

function loadInspectorTab() {
    try {
        const v = localStorage.getItem(INSPECTOR_TAB_KEY);
        return v === 'layers' ? 'layers' : 'design';
    } catch {
        return 'design';
    }
}

function loadInspectorPanelOpen() {
    try {
        const v = localStorage.getItem(INSPECTOR_PANEL_KEY);
        if (v !== null) return v === 'true';
        const legacy = localStorage.getItem(PROPS_PANEL_KEY);
        if (legacy !== null) return legacy === 'true';
    } catch {}
    return true;
}

function applyNodesReplace(nodes, items) {
    if (!items?.length) return nodes;
    const byId = new Map(items.map((i) => [i.id, i.node]));
    return nodes.map((n) => (byId.has(n.id) ? { ...byId.get(n.id) } : n));
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
    rulersVisible: loadRulersVisible(),
    /** Nós copiados/recortados (Ctrl+C / Ctrl+X) para colar */
    clipboardNodes: [],
    clipboardPasteGeneration: 0,
    inspectorPanelOpen: loadInspectorPanelOpen(),
    inspectorTab: loadInspectorTab(),
    spacePages: [{ id: DEFAULT_PAGE_ID, name: 'Canvas principal' }],
    activePageId: DEFAULT_PAGE_ID,
    lastCreatedNodeId: null,
    dirtyNodeIds: [],
    history: [],
    historyIndex: -1,
    suppressRealtimeUntil: 0,
    revision: 0,
    /** @type {Record<string, { entity: string, snapshot: unknown }>} */
    pendingOps: {},

    setSpaceId: (spaceId) => {
        const pages = spaceId ? loadSpacePages(spaceId) : [{ id: DEFAULT_PAGE_ID, name: 'Canvas principal' }];
        set({
            spaceId,
            spacePages: pages,
            activePageId: pages[0]?.id ?? DEFAULT_PAGE_ID,
            nodes: [],
            connectors: [],
            comments: [],
            selectedNodeIds: [],
            activeTool: 'select',
            connectorFromNodeId: null,
            editingNodeId: null,
            editTypingSeed: null,
            dirtyNodeIds: [],
            history: [],
            historyIndex: -1,
            revision: 0,
            pendingOps: {},
        });
    },

    setActivePageId: (activePageId) =>
        set({ activePageId: activePageId ?? DEFAULT_PAGE_ID, selectedNodeIds: [] }),

    addSpacePage: (name) => set((state) => {
        if (!state.spaceId) return state;
        const page = createPageEntry(name || newPageName(state.spacePages));
        const spacePages = [...state.spacePages, page];
        saveSpacePages(state.spaceId, spacePages);
        return { spacePages, activePageId: page.id, selectedNodeIds: [] };
    }),

    renameSpacePage: (pageId, name) => set((state) => {
        const trimmed = String(name ?? '').trim();
        if (!trimmed || !state.spaceId) return state;
        const spacePages = state.spacePages.map((p) =>
            p.id === pageId ? { ...p, name: trimmed } : p
        );
        saveSpacePages(state.spaceId, spacePages);
        return { spacePages };
    }),

    deleteSpacePage: (pageId) => set((state) => {
        if (state.spacePages.length <= 1 || !state.spaceId) return state;
        const spacePages = state.spacePages.filter((p) => p.id !== pageId);
        const activePageId =
            state.activePageId === pageId ? spacePages[0].id : state.activePageId;
        saveSpacePages(state.spaceId, spacePages);
        return { spacePages, activePageId, selectedNodeIds: [] };
    }),

    duplicateSpacePage: (pageId) => set((state) => {
        if (!state.spaceId) return state;
        const source = state.spacePages.find((p) => p.id === pageId);
        if (!source) return state;
        const page = createPageEntry(`${source.name} (cópia)`);
        const spacePages = [...state.spacePages, page];
        saveSpacePages(state.spaceId, spacePages);
        return { spacePages, activePageId: page.id, selectedNodeIds: [] };
    }),

    getActivePageNodes: () => {
        const state = get();
        return filterNodesByPage(state.nodes, state.activePageId);
    },

    setActiveTool: (activeTool) => set({ activeTool }),
    setConnectorFromNodeId: (connectorFromNodeId) => set({ connectorFromNodeId: connectorFromNodeId ?? null }),
    editingNodeId: null,
    editTypingSeed: null,
    setEditingNodeId: (editingNodeId) => set({
        editingNodeId: editingNodeId ?? null,
        ...(editingNodeId == null ? { editTypingSeed: null } : {}),
    }),
    setEditTypingSeed: (editTypingSeed) => set({ editTypingSeed: editTypingSeed ?? null }),

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

    setRulersVisible: (rulersVisible) => {
        try {
            localStorage.setItem(RULERS_STORAGE_KEY, rulersVisible ? 'true' : 'false');
        } catch {}
        set({ rulersVisible });
    },

    setClipboardNodes: (clipboardNodes) => set({
        clipboardNodes: Array.isArray(clipboardNodes) ? clipboardNodes : [],
    }),

    setClipboardPasteGeneration: (clipboardPasteGeneration) =>
        set({ clipboardPasteGeneration: Math.max(0, clipboardPasteGeneration ?? 0) }),

    setInspectorPanelOpen: (inspectorPanelOpen) => {
        try {
            localStorage.setItem(INSPECTOR_PANEL_KEY, inspectorPanelOpen ? 'true' : 'false');
        } catch {}
        set({ inspectorPanelOpen });
    },

    setInspectorTab: (inspectorTab) => {
        const tab = inspectorTab === 'layers' ? 'layers' : 'design';
        try {
            localStorage.setItem(INSPECTOR_TAB_KEY, tab);
        } catch {}
        set({ inspectorTab: tab });
    },

    setSelection: (selectedNodeIds) => set({
        selectedNodeIds: Array.isArray(selectedNodeIds) ? selectedNodeIds : [],
    }),

    setLastCreatedNodeId: (id) => set({ lastCreatedNodeId: id ?? null }),

    addNode: (node) => set((state) => ({
        nodes: [...state.nodes, node],
    })),

    patchNode: (nodeId, patch, options = {}) => set((state) => {
        const idx = state.nodes.findIndex((n) => n.id === nodeId);
        if (idx < 0) return state;
        const next = [...state.nodes];
        next[idx] = { ...next[idx], ...patch };
        const markDirty = options.remote !== true;
        return {
            nodes: next,
            dirtyNodeIds: markDirty && !state.dirtyNodeIds.includes(nodeId)
                ? [...state.dirtyNodeIds, nodeId]
                : state.dirtyNodeIds,
        };
    }),

    applyRemotePatch: (nodeId, patch) => {
        get().patchNode(nodeId, patch, { remote: true });
    },

    patchNodes: (patches, options = {}) => set((state) => {
        const byId = new Map(patches.map((p) => [p.id, p.patch]));
        const next = state.nodes.map((n) =>
            byId.has(n.id) ? { ...n, ...byId.get(n.id) } : n
        );
        const markDirty = options.remote !== true;
        const dirty = markDirty
            ? [...new Set([...state.dirtyNodeIds, ...patches.map((p) => p.id)])]
            : state.dirtyNodeIds;
        return { nodes: next, dirtyNodeIds: dirty };
    }),

    applyRemotePatches: (patches) => {
        get().patchNodes(patches, { remote: true });
    },

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
        let nodes = [...state.nodes];

        switch (entry.type) {
            case 'node_move':
                if (entry.payload.before && entry.payload.id) {
                    nodes = nodes.map((n) =>
                        n.id === entry.payload.id
                            ? { ...n, x: entry.payload.before.x, y: entry.payload.before.y }
                            : n
                    );
                }
                break;
            case 'node_resize':
            case 'node_edit':
                if (entry.payload.before && entry.payload.id) {
                    nodes = nodes.map((n) =>
                        n.id === entry.payload.id ? { ...n, ...entry.payload.before } : n
                    );
                }
                break;
            case 'node_delete': {
                const deleted =
                    entry.payload.nodes ?? (entry.payload.node ? [entry.payload.node] : []);
                const existing = new Set(nodes.map((n) => n.id));
                for (const node of deleted) {
                    if (!existing.has(node.id)) nodes.push({ ...node });
                }
                break;
            }
            case 'node_add':
                if (entry.payload.node?.id) {
                    nodes = nodes.filter((n) => n.id !== entry.payload.node.id);
                }
                break;
            case 'nodes_replace':
                nodes = applyNodesReplace(nodes, entry.payload.before);
                break;
            case 'nodes_add_batch': {
                const batch = entry.payload.nodes ?? [];
                const removeIds = new Set(batch.map((n) => n.id));
                nodes = nodes.filter((n) => !removeIds.has(n.id));
                break;
            }
            default:
                break;
        }

        return { nodes, historyIndex: nextIndex };
    }),

    redo: () => set((state) => {
        if (state.historyIndex >= state.history.length - 1) return state;
        const nextIndex = state.historyIndex + 1;
        const entry = state.history[nextIndex];
        let nodes = [...state.nodes];

        switch (entry.type) {
            case 'node_move':
                if (entry.payload.after && entry.payload.id) {
                    nodes = nodes.map((n) =>
                        n.id === entry.payload.id
                            ? { ...n, x: entry.payload.after.x, y: entry.payload.after.y }
                            : n
                    );
                }
                break;
            case 'node_resize':
            case 'node_edit':
                if (entry.payload.after && entry.payload.id) {
                    nodes = nodes.map((n) =>
                        n.id === entry.payload.id ? { ...n, ...entry.payload.after } : n
                    );
                }
                break;
            case 'node_delete': {
                const deleted =
                    entry.payload.nodes ?? (entry.payload.node ? [entry.payload.node] : []);
                const removeIds = new Set(deleted.map((n) => n.id));
                nodes = nodes.filter((n) => !removeIds.has(n.id));
                break;
            }
            case 'node_add':
                if (entry.payload.node?.id) {
                    if (!nodes.some((n) => n.id === entry.payload.node.id)) {
                        nodes.push({ ...entry.payload.node });
                    }
                }
                break;
            case 'nodes_replace':
                nodes = applyNodesReplace(nodes, entry.payload.after);
                break;
            case 'nodes_add_batch': {
                const batch = entry.payload.nodes ?? [];
                const existing = new Set(nodes.map((n) => n.id));
                for (const node of batch) {
                    if (!existing.has(node.id)) nodes.push({ ...node });
                }
                break;
            }
            default:
                break;
        }

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

    setRevision: (revision) => set({ revision: revision ?? 0 }),

    hydrateRoom: ({ nodes, connectors, comments, revision }) => set({
        nodes: nodes ?? [],
        connectors: connectors ?? [],
        comments: comments ?? [],
        revision: revision ?? 0,
        dirtyNodeIds: [],
        selectedNodeIds: [],
        pendingOps: {},
    }),

    registerPendingOp: (opId, entity, snapshot) => set((state) => ({
        pendingOps: { ...state.pendingOps, [opId]: { entity, snapshot } },
    })),

    clearPendingOp: (opId) => set((state) => {
        const next = { ...state.pendingOps };
        delete next[opId];
        return { pendingOps: next };
    }),

    rollbackPendingOp: (opId) => set((state) => {
        const pending = state.pendingOps[opId];
        if (!pending) return state;
        const nextPending = { ...state.pendingOps };
        delete nextPending[opId];
        if (pending.entity === 'node' && pending.snapshot) {
            const idx = state.nodes.findIndex((n) => n.id === pending.snapshot.id);
            if (idx < 0) {
                return {
                    nodes: state.nodes.filter((n) => n.id !== pending.snapshot?.id),
                    pendingOps: nextPending,
                };
            }
            const nodes = [...state.nodes];
            nodes[idx] = pending.snapshot;
            return { nodes, pendingOps: nextPending };
        }
        return { pendingOps: nextPending };
    }),

    addNodeRemote: (node) => set((state) => {
        if (state.nodes.some((n) => n.id === node.id)) return state;
        return { nodes: [...state.nodes, node] };
    }),

    removeNodeRemote: (nodeId) => set((state) => ({
        nodes: state.nodes.filter((n) => n.id !== nodeId),
        selectedNodeIds: state.selectedNodeIds.filter((id) => id !== nodeId),
    })),

    addConnectorRemote: (connector) => set((state) => {
        if (state.connectors.some((c) => c.id === connector.id)) return state;
        return { connectors: [...state.connectors, connector] };
    }),

    removeConnectorRemote: (connectorId) => set((state) => ({
        connectors: state.connectors.filter((c) => c.id !== connectorId),
    })),

    patchConnectorRemote: (connectorId, patch) => set((state) => {
        const idx = state.connectors.findIndex((c) => c.id === connectorId);
        if (idx < 0) return state;
        const next = [...state.connectors];
        next[idx] = { ...next[idx], ...patch };
        return { connectors: next };
    }),

    addCommentRemote: (comment) => set((state) => {
        if (state.comments.some((c) => c.id === comment.id)) return state;
        return { comments: [...state.comments, comment] };
    }),

    removeCommentRemote: (commentId) => set((state) => ({
        comments: state.comments.filter((c) => c.id !== commentId),
    })),

    patchCommentRemote: (commentId, patch) => set((state) => {
        const idx = state.comments.findIndex((c) => c.id === commentId);
        if (idx < 0) return state;
        const next = [...state.comments];
        next[idx] = { ...next[idx], ...patch };
        return { comments: next };
    }),
}));
