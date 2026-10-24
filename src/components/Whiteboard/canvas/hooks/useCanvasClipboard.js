/** Viewport persistido e área de transferência do canvas (copiar/recortar/colar/duplicar) + commit de edição de texto. */
import { useCallback } from 'react';
import { useViewport } from '../../interaction/hooks/useViewport';
import { useWhiteboardStore } from '../../../../stores/whiteboardStore';
import { useWhiteboardSelectionStore } from '../../../../stores/whiteboardSelectionStore';
import { deleteNode as deleteNodeService } from '../../../../services/whiteboardService';
import { useWhiteboardUndo } from '../../interaction/hooks/useWhiteboardUndo';
import { screenToWorldWithContainer } from '../../interaction/viewport/viewportUtils';
import { copyNodesToClipboard, setClipboardFromNodes, duplicateSelectedNodes, pasteFromClipboard } from '../../core/ops/whiteboardNodeOps';
import { pasteClipboardContent } from '../../core/ops/pasteExternalContent.js';

export function useCanvasClipboard(ctx) {
    const {
        spaceId,
        onViewportChange,
        containerRef,
        viewportRef,
        lastPointerClientRef,
        initialPan,
        initialZoom,
        user,
        addToast,
        collabCreateNode,
        collabDeleteNodes,
        collabConnected,
        setSelection,
        setStoreViewport,
        handleCopyGuides,
        handleCutGuides,
        handlePasteGuides,
        getViewportCenterWorld,
    } = ctx;

    const persistViewport = useCallback(
        (pan, zoom) => {
            setStoreViewport({ panX: pan.x, panY: pan.y, zoom });
            if (onViewportChange) onViewportChange(pan, zoom);
        },
        [setStoreViewport, onViewportChange]
    );

    const viewportState = useViewport(initialPan, initialZoom, persistViewport, containerRef);

    const getZoomFocalClient = useCallback(() => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return { x: 0, y: 0 };
        const p = lastPointerClientRef.current;
        if (p) return p;
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }, []);

    const { undo: performUndo, redo: performRedo } = useWhiteboardUndo();

    const nodeOpsCtx = useCallback(
        () => ({
            spaceId,
            userId: user?.id,
            collabCreateNode,
            collabConnected,
            store: useWhiteboardStore,
            viewportZoom:
                viewportRef.current?.zoom ??
                useWhiteboardSelectionStore.getState().viewport?.zoom ??
                1,
            onUploadError: (message) => addToast(message || 'Falha ao enviar arquivo.', 'error'),
        }),
        [spaceId, user?.id, collabCreateNode, collabConnected, addToast]
    );

    const handleCopy = useCallback(() => {
        if (useWhiteboardSelectionStore.getState().selectedGuideIds.length) {
            handleCopyGuides();
            return;
        }
        copyNodesToClipboard(useWhiteboardStore);
    }, [handleCopyGuides]);

    const getPastePlacement = useCallback(() => {
        const rect = containerRef.current?.getBoundingClientRect();
        const p = lastPointerClientRef.current;
        if (p && rect && viewportRef.current) {
            const world = screenToWorldWithContainer(p.x, p.y, rect, viewportRef.current);
            return { x: world.x, y: world.y, anchor: 'center' };
        }
        const center = getViewportCenterWorld();
        return { x: center.x, y: center.y, anchor: 'center' };
    }, [getViewportCenterWorld]);

    const handlePaste = useCallback(
        async (clipboardData = null) => {
            const clipGuides = useWhiteboardSelectionStore.getState().clipboardGuides;
            if (clipGuides?.length && !clipboardData) {
                await handlePasteGuides();
                return;
            }
            const ctx = nodeOpsCtx();
            const placement = getPastePlacement();
            await pasteClipboardContent(ctx, placement, clipboardData, () => pasteFromClipboard(ctx));
        },
        [nodeOpsCtx, getPastePlacement, handlePasteGuides]
    );

    const handlePasteInPlace = useCallback(
        async (clipboardData = null) => {
            const ctx = nodeOpsCtx();
            const placement = getPastePlacement();
            await pasteClipboardContent(ctx, placement, clipboardData, () =>
                pasteFromClipboard(ctx, { inPlace: true })
            );
        },
        [nodeOpsCtx, getPastePlacement]
    );

    const handleViewportPaste = useCallback(
        (e) => {
            const el = document.activeElement;
            if (el) {
                const tag = el.tagName;
                const isEditable =
                    tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
                if (isEditable) {
                    if (el.closest?.('.whiteboard-node-wrapper')) return;
                    if (el.closest?.('.whiteboard-floating-toolbar')) return;
                    return;
                }
            }
            e.preventDefault();
            void handlePaste(e.clipboardData);
        },
        [handlePaste]
    );

    const handleDuplicate = useCallback(async () => {
        await duplicateSelectedNodes(nodeOpsCtx());
    }, [nodeOpsCtx]);

    const handleCut = useCallback(async () => {
        if (useWhiteboardSelectionStore.getState().selectedGuideIds.length) {
            await handleCutGuides();
            return;
        }
        const state = useWhiteboardStore.getState();
        if (!state.selectedNodeIds.length) return;
        const selectedNodes = state.nodes.filter((n) => state.selectedNodeIds.includes(n.id));
        setClipboardFromNodes(useWhiteboardStore, selectedNodes);
        useWhiteboardStore.getState().pushHistory({
            type: 'node_delete',
            payload: { nodes: selectedNodes.map((n) => JSON.parse(JSON.stringify(n))) },
        });
        if (!collabConnected) {
            for (const id of state.selectedNodeIds) {
                deleteNodeService(id);
            }
        }
        collabDeleteNodes(state.selectedNodeIds);
        setSelection([]);
    }, [collabConnected, collabDeleteNodes, setSelection, handleCutGuides]);

    const commitTextEdit = useCallback(() => {
        const el = document.activeElement;
        if (
            el &&
            (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') &&
            el.closest?.('.whiteboard-node-wrapper')
        ) {
            el.blur();
        }
    }, []);

    return {
        viewportState,
        getZoomFocalClient,
        performUndo,
        performRedo,
        handleCopy,
        handlePaste,
        handlePasteInPlace,
        handleViewportPaste,
        handleDuplicate,
        handleCut,
        commitTextEdit,
    };
}
