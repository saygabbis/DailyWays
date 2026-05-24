import { create } from 'zustand';
import {
    loadSpacePages,
    saveSpacePages,
    createPageEntry,
    newPageName,
    DEFAULT_PAGE_ID,
    filterNodesByPage,
} from '../components/Whiteboard/core/pages/whiteboardPages';
import { normalizeNodes } from '../components/Whiteboard/core/nodeNormalize.js';
import { useWhiteboardSelectionStore } from './whiteboardSelectionStore';

const MAX_HISTORY = 600;

export function createHistoryEntry(type, payload) {
    return { type, payload, timestamp: Date.now() };
}

function applyNodesReplace(nodes, items) {
    if (!items?.length) return nodes;
    const byId = new Map(items.map((i) => [i.id, i.node]));
    return nodes.map((n) => (byId.has(n.id) ? { ...byId.get(n.id) } : n));
}

export const useWhiteboardDocumentStore = create((set, get) => ({
    spaceId: null,
    nodes: [],
    connectors: [],
    comments: [],
    spacePages: [{ id: DEFAULT_PAGE_ID, name: 'Canvas principal' }],
    activePageId: DEFAULT_PAGE_ID,
    dirtyNodeIds: [],
    history: [],
    historyIndex: -1,
    suppressRealtimeUntil: 0,
    revision: 0,
    pendingOps: {},

    setSpaceId: (spaceId) => {
        const pages = spaceId ? loadSpacePages(spaceId) : [{ id: DEFAULT_PAGE_ID, name: 'Canvas principal' }];
        useWhiteboardSelectionStore.getState().resetForSpace();
        set({
            spaceId,
            spacePages: pages,
            activePageId: pages[0]?.id ?? DEFAULT_PAGE_ID,
            nodes: [],
            connectors: [],
            comments: [],
            dirtyNodeIds: [],
            history: [],
            historyIndex: -1,
            revision: 0,
            pendingOps: {},
        });
    },

    setActivePageId: (activePageId) => {
        useWhiteboardSelectionStore.getState().setSelection([]);
        set({ activePageId: activePageId ?? DEFAULT_PAGE_ID });
    },

    addSpacePage: (name) => set((state) => {
        if (!state.spaceId) return state;
        const page = createPageEntry(name || newPageName(state.spacePages));
        const spacePages = [...state.spacePages, page];
        saveSpacePages(state.spaceId, spacePages);
        useWhiteboardSelectionStore.getState().setSelection([]);
        return { spacePages, activePageId: page.id };
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
        useWhiteboardSelectionStore.getState().setSelection([]);
        return { spacePages, activePageId };
    }),

    duplicateSpacePage: (pageId) => set((state) => {
        if (!state.spaceId) return state;
        const source = state.spacePages.find((p) => p.id === pageId);
        if (!source) return state;
        const page = createPageEntry(`${source.name} (cópia)`);
        const spacePages = [...state.spacePages, page];
        saveSpacePages(state.spaceId, spacePages);
        useWhiteboardSelectionStore.getState().setSelection([]);
        return { spacePages, activePageId: page.id };
    }),

    getActivePageNodes: () => {
        const state = get();
        return filterNodesByPage(state.nodes, state.activePageId);
    },

    setNodes: (nodes) => set({ nodes: normalizeNodes(nodes ?? []) }),
    setConnectors: (connectors) => set({ connectors: connectors ?? [] }),
    setComments: (comments) => set({ comments: comments ?? [] }),

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

    deleteNodes: (ids) => {
        const setIds = new Set(ids);
        useWhiteboardSelectionStore.getState().pruneSelection(ids);
        set((state) => ({
            nodes: state.nodes.filter((n) => !setIds.has(n.id)),
            dirtyNodeIds: state.dirtyNodeIds.filter((id) => !setIds.has(id)),
        }));
    },

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

    hydrateRoom: ({ nodes, connectors, comments, revision }) => {
        useWhiteboardSelectionStore.getState().setSelection([]);
        set({
            nodes: normalizeNodes(nodes ?? []),
            connectors: connectors ?? [],
            comments: comments ?? [],
            revision: revision ?? 0,
            dirtyNodeIds: [],
            pendingOps: {},
        });
    },

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

    removeNodeRemote: (nodeId) => {
        useWhiteboardSelectionStore.getState().pruneSelection([nodeId]);
        set((state) => ({
            nodes: state.nodes.filter((n) => n.id !== nodeId),
        }));
    },

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
