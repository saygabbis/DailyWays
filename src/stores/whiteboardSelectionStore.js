import { create } from 'zustand';

const GRID_STORAGE_KEY = 'dailyways_grid_visible';
const RULERS_STORAGE_KEY = 'dailyways_rulers_visible';
const SNAP_STORAGE_KEY = 'dailyways_snap_enabled';
const INSPECTOR_PANEL_KEY = 'dailyways_inspector_panel_open';
const PROPS_PANEL_KEY = 'dailyways_props_panel_open';
const INSPECTOR_TAB_KEY = 'dailyways_inspector_tab';

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

function loadSnapEnabled() {
    try {
        const v = localStorage.getItem(SNAP_STORAGE_KEY);
        if (v !== null) return v === 'true';
    } catch {}
    return true;
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

export const useWhiteboardSelectionStore = create((set, get) => ({
    selectedNodeIds: [],
    activeTool: 'select',
    connectorFromNodeId: null,
    editingNodeId: null,
    editTypingSeed: null,
    clipboardNodes: [],
    clipboardPasteGeneration: 0,
    inspectorPanelOpen: loadInspectorPanelOpen(),
    inspectorTab: loadInspectorTab(),
    gridVisible: loadGridVisible(),
    rulersVisible: loadRulersVisible(),
    snapEnabled: loadSnapEnabled(),
    viewport: { panX: 0, panY: 0, zoom: 1 },
    lastCreatedNodeId: null,
    /** toolId → variantId para ferramentas com submenu (ex.: shape → rectangle) */
    toolVariants: { shape: 'rectangle' },

    /** sectionId → expanded (persiste enquanto o painel estiver aberto) */
    inspectorSectionState: {},

    /** Preview visual do arraste — evita patchNodes a cada frame */
    nodeDragPreview: null,

    /** Drill-down de grupos aninhados: { nodeId, index } */
    groupDrill: null,

    /** Ctrl+clique: não expandir para o grupo lógico em drag/resize */
    isolateSelection: false,

    resetForSpace: () => set({
        selectedNodeIds: [],
        activeTool: 'select',
        connectorFromNodeId: null,
        editingNodeId: null,
        editTypingSeed: null,
        toolVariants: { shape: 'rectangle' },
        inspectorSectionState: {},
        nodeDragPreview: null,
        groupDrill: null,
        isolateSelection: false,
    }),

    setActiveTool: (activeTool) => set({ activeTool }),
    setConnectorFromNodeId: (connectorFromNodeId) =>
        set({ connectorFromNodeId: connectorFromNodeId ?? null }),

    setEditingNodeId: (editingNodeId) => set({
        editingNodeId: editingNodeId ?? null,
        ...(editingNodeId == null ? { editTypingSeed: null } : {}),
    }),
    setEditTypingSeed: (editTypingSeed) => set({ editTypingSeed: editTypingSeed ?? null }),

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

    setSnapEnabled: (snapEnabled) => {
        try {
            localStorage.setItem(SNAP_STORAGE_KEY, snapEnabled ? 'true' : 'false');
        } catch {}
        set({ snapEnabled });
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
        groupDrill: null,
        isolateSelection: false,
    }),

    setSelectionWithDrill: (selectedNodeIds, groupDrill = null, isolateSelection = false) => set({
        selectedNodeIds: Array.isArray(selectedNodeIds) ? selectedNodeIds : [],
        groupDrill: groupDrill ?? null,
        isolateSelection: Boolean(isolateSelection),
    }),

    pruneSelection: (ids) => {
        const remove = new Set(ids);
        set((state) => ({
            selectedNodeIds: state.selectedNodeIds.filter((id) => !remove.has(id)),
        }));
    },

    setLastCreatedNodeId: (id) => set({ lastCreatedNodeId: id ?? null }),

    setToolVariant: (toolId, variantId) => set((state) => ({
        toolVariants: {
            ...state.toolVariants,
            [toolId]: variantId,
        },
    })),

    getToolVariant: (toolId) => {
        const state = get();
        return state.toolVariants?.[toolId] ?? null;
    },

    getInspectorSectionExpanded: (sectionId, defaultExpanded = false) => {
        const stored = get().inspectorSectionState?.[sectionId];
        return stored !== undefined ? stored : defaultExpanded;
    },

    setInspectorSectionExpanded: (sectionId, expanded) => set((state) => ({
        inspectorSectionState: {
            ...state.inspectorSectionState,
            [sectionId]: expanded,
        },
    })),

    setNodeDragPreview: (preview) => set({ nodeDragPreview: preview }),

    clearNodeDragPreview: () => set({ nodeDragPreview: null }),
}));
