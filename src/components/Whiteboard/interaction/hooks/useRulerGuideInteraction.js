import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useWhiteboardStore } from '../../../../stores/whiteboardStore';
import { useWhiteboardSelectionStore } from '../../../../stores/whiteboardSelectionStore';
import { useWhiteboardDocumentStore } from '../../../../stores/whiteboardDocumentStore';
import { uuidv4 } from '../../../../utils/uuid';
import { filterGuidesByPage } from '../../core/guides/rulerGuides';
import {
    copyGuidesToClipboard,
    cutSelectedGuides,
    pasteGuidesFromClipboard,
    deleteSelectedGuides,
    createGuideInDb,
    persistGuidePosition,
} from '../../core/guides/rulerGuideOps';
import {
    pickGuideAt,
    guidePositionFromPointer,
    guidePreviewPositionFromRuler,
    isPointerOnRulerBand,
} from '../guides/guideInteraction';
import { RULER_SIZE } from '../../canvas/overlays/RulersOverlay';
import { computeSnapForRulerGuidePosition, snapGuidesEqual } from '../snap/whiteboardSnap';

export function useRulerGuideInteraction({ containerRef, viewportRef, collabConnected, spaceId }) {
    const [guideCreatePreview, setGuideCreatePreview] = useState(null);
    const [guideSnapGuides, setGuideSnapGuides] = useState([]);
    const guideSnapGuidesRef = useRef([]);
    const guideCreateRef = useRef(null);
    const guideDragRef = useRef(null);

    const guidesVisible = useWhiteboardSelectionStore((s) => s.guidesVisible);
    const rulersVisible = useWhiteboardSelectionStore((s) => s.rulersVisible);
    const selectedGuideIds = useWhiteboardSelectionStore((s) => s.selectedGuideIds);
    const lockedGuideIds = useWhiteboardSelectionStore((s) => s.lockedGuideIds);
    const rulerGuides = useWhiteboardDocumentStore((s) => s.rulerGuides);
    const activePageId = useWhiteboardDocumentStore((s) => s.activePageId);

    const pageGuides = useMemo(
        () => filterGuidesByPage(rulerGuides, activePageId),
        [rulerGuides, activePageId]
    );

    const setGuideSnapGuidesIfChanged = useCallback((guides) => {
        const next = guides ?? [];
        if (snapGuidesEqual(guideSnapGuidesRef.current, next)) return;
        guideSnapGuidesRef.current = next;
        setGuideSnapGuides(next);
    }, []);

    const snapGuidePosition = useCallback(
        (axis, rawPosition, excludeGuideId = null, { showFeedback = true } = {}) => {
            const doc = useWhiteboardDocumentStore.getState();
            const sel = useWhiteboardSelectionStore.getState();
            const vp = viewportRef.current;
            const result = computeSnapForRulerGuidePosition({
                axis,
                position: rawPosition,
                nodes: doc.nodes,
                rulerGuides: doc.rulerGuides,
                pageId: doc.activePageId,
                zoom: vp?.zoom ?? 1,
                snapEnabled: sel.snapEnabled,
                guidesVisible: sel.guidesVisible,
                excludeGuideId,
            });
            if (showFeedback) {
                setGuideSnapGuidesIfChanged(result.guides);
            }
            return result.position;
        },
        [viewportRef, setGuideSnapGuidesIfChanged]
    );

    const snapEnabled = useWhiteboardSelectionStore((s) => s.snapEnabled);

    const clearGuideSnapGuides = useCallback(() => {
        setGuideSnapGuidesIfChanged([]);
    }, [setGuideSnapGuidesIfChanged]);

    useEffect(() => {
        if (!guidesVisible || !snapEnabled) {
            clearGuideSnapGuides();
        }
    }, [guidesVisible, snapEnabled, clearGuideSnapGuides]);

    const handleDeleteSelectedGuides = useCallback(async () => {
        const ids = useWhiteboardSelectionStore.getState().selectedGuideIds;
        if (!ids.length) return;
        await deleteSelectedGuides(useWhiteboardStore, ids);
        useWhiteboardSelectionStore.getState().clearGuideSelection();
    }, []);

    const handleCopyGuides = useCallback(() => {
        const ids = useWhiteboardSelectionStore.getState().selectedGuideIds;
        if (!ids.length) return;
        copyGuidesToClipboard(useWhiteboardStore, ids);
    }, []);

    const handleCutGuides = useCallback(async () => {
        const ids = useWhiteboardSelectionStore.getState().selectedGuideIds;
        if (!ids.length) return;
        await cutSelectedGuides(useWhiteboardStore, ids);
    }, []);

    const handlePasteGuides = useCallback(async () => {
        const state = useWhiteboardStore.getState();
        await pasteGuidesFromClipboard(useWhiteboardStore, state.activePageId);
    }, []);

    const handleToggleGuideLock = useCallback(() => {
        const sel = useWhiteboardSelectionStore.getState().selectedGuideIds;
        const sid = useWhiteboardDocumentStore.getState().spaceId;
        if (!sel.length || !sid) return;
        useWhiteboardSelectionStore.getState().toggleGuideLock(sel, sid);
    }, []);

    const handleRulerPointerDown = useCallback(
        (axis, e) => {
            if (!rulersVisible) return;
            const rect = containerRef.current?.getBoundingClientRect();
            const vp = viewportRef.current;
            if (!rect || !vp) return;

            const updatePreview = (ev) => {
                const raw = guidePreviewPositionFromRuler(axis, ev.clientX, ev.clientY, rect, vp);
                const pos = snapGuidePosition(axis, raw, null);
                setGuideCreatePreview({ axis, position: pos });
            };
            updatePreview(e);
            guideCreateRef.current = { axis };

            const onMove = (ev) => updatePreview(ev);
            const onUp = async (ev) => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                window.removeEventListener('pointercancel', onUp);
                guideCreateRef.current = null;
                clearGuideSnapGuides();

                const band = isPointerOnRulerBand(ev.clientX, ev.clientY, rect, RULER_SIZE);
                const cancel =
                    (axis === 'y' && band.horizontal) || (axis === 'x' && band.vertical);
                setGuideCreatePreview(null);
                if (cancel) return;

                const raw = guidePreviewPositionFromRuler(axis, ev.clientX, ev.clientY, rect, vp);
                const position = snapGuidePosition(axis, raw, null, { showFeedback: false });
                clearGuideSnapGuides();
                const doc = useWhiteboardDocumentStore.getState();
                const sid = doc.spaceId || spaceId;
                if (!sid) return;

                const guide = {
                    id: uuidv4(),
                    spaceId: sid,
                    pageId: doc.activePageId,
                    axis,
                    position,
                };
                const res = await createGuideInDb(sid, guide);
                if (!res.success) return;
                doc.addRulerGuide(guide);
            };

            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', onUp);
        },
        [rulersVisible, containerRef, viewportRef, collabConnected, spaceId, snapGuidePosition, clearGuideSnapGuides]
    );

    const handleGuidePointerDown = useCallback(
        (e, guideId) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            e.preventDefault();

            const selStore = useWhiteboardSelectionStore.getState();
            if (selStore.isGuideLocked(guideId)) return;

            selStore.setSelectedGuideIds([guideId]);

            const doc = useWhiteboardDocumentStore.getState();
            const guide = doc.rulerGuides.find((g) => g.id === guideId);
            if (!guide) return;

            const rect = containerRef.current?.getBoundingClientRect();
            const vp = viewportRef.current;
            if (!rect || !vp) return;

            const startPosition = guide.position;
            guideDragRef.current = {
                guideId,
                axis: guide.axis,
                startPosition,
                skipHistory: true,
            };

            const onMove = (ev) => {
                const raw = guidePositionFromPointer(guide, ev.clientX, ev.clientY, rect, vp);
                const pos = snapGuidePosition(guide.axis, raw, guideId);
                doc.patchRulerGuide(guideId, { position: pos }, { skipHistory: true });
            };

            const onUp = async (ev) => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                window.removeEventListener('pointercancel', onUp);
                const ref = guideDragRef.current;
                guideDragRef.current = null;
                clearGuideSnapGuides();
                if (!ref) return;

                const raw = guidePositionFromPointer(guide, ev.clientX, ev.clientY, rect, vp);
                const pos = snapGuidePosition(guide.axis, raw, guideId, { showFeedback: false });
                clearGuideSnapGuides();
                if (Math.abs(pos - ref.startPosition) > 0.001) {
                    doc.patchRulerGuide(ref.guideId, { position: pos }, { skipHistory: true });
                    doc.pushHistory({
                        type: 'guide_move',
                        payload: {
                            id: ref.guideId,
                            before: { position: ref.startPosition },
                            after: { position: pos },
                        },
                    });
                    await persistGuidePosition(useWhiteboardStore, ref.guideId, pos);
                }
            };

            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', onUp);
        },
        [containerRef, viewportRef, collabConnected, snapGuidePosition, clearGuideSnapGuides]
    );

    const tryPickGuideOnBackground = useCallback(
        (e) => {
            if (!guidesVisible) return false;
            const rect = containerRef.current?.getBoundingClientRect();
            const vp = viewportRef.current;
            if (!rect || !vp) return false;
            const doc = useWhiteboardDocumentStore.getState();
            const sel = useWhiteboardSelectionStore.getState();
            const id = pickGuideAt(
                doc.rulerGuides,
                doc.activePageId,
                e.clientX,
                e.clientY,
                rect,
                vp,
                sel.lockedGuideIds
            );
            if (!id) return false;
            e.preventDefault();
            e.stopPropagation();
            sel.setSelectedGuideIds([id]);
            return true;
        },
        [guidesVisible, containerRef, viewportRef]
    );

    return {
        guideCreatePreview,
        guideSnapGuides,
        pageGuides,
        guidesVisible,
        selectedGuideIds,
        lockedGuideIds,
        handleRulerPointerDown,
        handleGuidePointerDown,
        handleToggleGuideLock,
        handleDeleteSelectedGuides,
        handleCopyGuides,
        handleCutGuides,
        handlePasteGuides,
        tryPickGuideOnBackground,
    };
}
