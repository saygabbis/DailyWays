import { uuidv4 } from '../../../../utils/uuid';
import {
    deleteRulerGuide,
    deleteRulerGuides,
    insertRulerGuide,
    updateRulerGuide,
} from '../../../../services/whiteboardService';
import { createHistoryEntry } from '../../../../stores/whiteboardDocumentStore';
import { useWhiteboardSelectionStore } from '../../../../stores/whiteboardSelectionStore';
import { pruneLockedGuideIds } from './rulerGuideLocks';
import { cloneGuide } from './rulerGuides';

const PASTE_OFFSET = 10;

export function copyGuidesToClipboard(store, guideIds) {
    const state = store.getState();
    const guides = state.rulerGuides.filter((g) => guideIds.includes(g.id));
    if (!guides.length) return;
    useWhiteboardSelectionStore.getState().setClipboardGuides(guides.map(cloneGuide));
}

export async function cutSelectedGuides(store, guideIds) {
    copyGuidesToClipboard(store, guideIds);
    await deleteSelectedGuides(store, guideIds);
}

export async function pasteGuidesFromClipboard(store, pageId) {
    const clip = useWhiteboardSelectionStore.getState().clipboardGuides;
    if (!clip?.length) return [];
    const state = store.getState();
    const spaceId = state.spaceId;
    if (!spaceId) return [];

    const created = [];
    for (const src of clip) {
        const guide = {
            id: uuidv4(),
            spaceId,
            pageId: pageId ?? state.activePageId,
            axis: src.axis,
            position: (src.position ?? 0) + PASTE_OFFSET,
        };
        const res = await insertRulerGuide(spaceId, guide);
        if (!res.success) continue;
        state.addRulerGuide(guide, { skipHistory: true });
        created.push(guide);
    }
    if (created.length) {
        state.pushHistory({
            type: 'guide_create_batch',
            payload: { guides: created.map(cloneGuide) },
        });
        useWhiteboardSelectionStore.getState().setSelectedGuideIds(created.map((g) => g.id));
        useWhiteboardSelectionStore.getState().setSelection([]);
    }
    return created.map((g) => g.id);
}

export async function deleteSelectedGuides(store, guideIds) {
    const state = store.getState();
    if (!guideIds?.length) return;
    if (!state.rulerGuides.some((g) => guideIds.includes(g.id))) return;

    await deleteRulerGuides(guideIds);
    state.removeRulerGuides(guideIds);
    pruneLockedGuideIds(state.spaceId, guideIds);
}

export async function persistGuidePosition(store, guideId, position) {
    await updateRulerGuide(guideId, { position });
}

export async function createGuideInDb(spaceId, guide) {
    return insertRulerGuide(spaceId, guide);
}

export async function removeGuideFromDb(guideId) {
    return deleteRulerGuide(guideId);
}
