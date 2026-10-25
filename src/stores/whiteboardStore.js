/**
 * Fachada de compatibilidade: documento + seleção/UI.
 * Preferir useWhiteboardDocumentStore / useWhiteboardSelectionStore em código novo.
 */
import { useWhiteboardDocumentStore } from './whiteboardDocumentStore';
import { useWhiteboardSelectionStore } from './whiteboardSelectionStore';
import { useShallow } from 'zustand/react/shallow';

export { getDefaultNodePayload, isCreationTool } from '../components/Whiteboard/core/nodeDefaults';

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

/**
 * Assina os DOIS stores inteiros: re-renderiza a cada mudança (inclusive a cada quadro de pan/zoom).
 * Em componentes use useWhiteboardFields(...) — só re-renderiza quando um dos campos pedidos muda.
 */
export function useWhiteboardStore(selector) {
    const doc = useWhiteboardDocumentStore();
    const sel = useWhiteboardSelectionStore();
    const merged = { ...doc, ...sel };
    return typeof selector === 'function' ? selector(merged) : merged;
}

function pickKeys(state, keys) {
    const out = {};
    for (const k of keys) out[k] = state[k];
    return out;
}

/**
 * Lê só os campos pedidos, cada um do store dono dele (comparação rasa).
 * Ex.: const { nodes, selectedNodeIds } = useWhiteboardFields('nodes', 'selectedNodeIds');
 */
export function useWhiteboardFields(...keys) {
    const docState = useWhiteboardDocumentStore.getState();
    const docKeys = keys.filter((k) => k in docState);
    const selKeys = keys.filter((k) => !(k in docState));
    const doc = useWhiteboardDocumentStore(useShallow((st) => pickKeys(st, docKeys)));
    const sel = useWhiteboardSelectionStore(useShallow((st) => pickKeys(st, selKeys)));
    return { ...doc, ...sel };
}

useWhiteboardStore.getState = getMergedState;
useWhiteboardStore.setState = setMergedState;
