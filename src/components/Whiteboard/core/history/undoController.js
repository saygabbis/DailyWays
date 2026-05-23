import { applyHistoryToCollab } from './whiteboardHistorySync.js';
import { useWhiteboardDocumentStore } from '../../../../stores/whiteboardDocumentStore';

/** Undo: muta o store local primeiro, depois sincroniza collab (ordem correta). */
export function performUndo(collabApi) {
    const doc = useWhiteboardDocumentStore.getState();
    if (doc.historyIndex < 0) return;
    const entry = doc.history[doc.historyIndex];
    doc.undo();
    applyHistoryToCollab(entry, 'undo', collabApi);
}

/** Redo: aplica redo no store e depois collab. */
export function performRedo(collabApi) {
    const doc = useWhiteboardDocumentStore.getState();
    if (!doc.canRedo()) return;
    const entry = doc.history[doc.historyIndex + 1];
    doc.redo();
    applyHistoryToCollab(entry, 'redo', collabApi);
}
