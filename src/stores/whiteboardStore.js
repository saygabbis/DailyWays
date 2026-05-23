/**
 * Fachada de compatibilidade: documento + seleção/UI.
 * Preferir useWhiteboardDocumentStore / useWhiteboardSelectionStore em código novo.
 */
import { useWhiteboardDocumentStore } from './whiteboardDocumentStore';
import { useWhiteboardSelectionStore } from './whiteboardSelectionStore';

export { createHistoryEntry } from './whiteboardDocumentStore';
export { getDefaultNodePayload, isCreationTool } from '../components/Whiteboard/core/nodeDefaults';
export { useWhiteboardDocumentStore } from './whiteboardDocumentStore';
export { useWhiteboardSelectionStore } from './whiteboardSelectionStore';

function getMergedState() {
    return {
        ...useWhiteboardDocumentStore.getState(),
        ...useWhiteboardSelectionStore.getState(),
    };
}

function setMergedState(partial) {
    const docKeys = new Set([
        'spaceId', 'nodes', 'connectors', 'comments', 'spacePages', 'activePageId',
        'dirtyNodeIds', 'history', 'historyIndex', 'suppressRealtimeUntil', 'revision', 'pendingOps',
    ]);
    const docPartial = {};
    const selPartial = {};
    for (const [k, v] of Object.entries(partial)) {
        if (docKeys.has(k)) docPartial[k] = v;
        else selPartial[k] = v;
    }
    if (Object.keys(docPartial).length) useWhiteboardDocumentStore.setState(docPartial);
    if (Object.keys(selPartial).length) useWhiteboardSelectionStore.setState(selPartial);
}

export function useWhiteboardStore(selector) {
    const doc = useWhiteboardDocumentStore();
    const sel = useWhiteboardSelectionStore();
    const merged = { ...doc, ...sel };
    return typeof selector === 'function' ? selector(merged) : merged;
}

useWhiteboardStore.getState = getMergedState;
useWhiteboardStore.setState = setMergedState;
