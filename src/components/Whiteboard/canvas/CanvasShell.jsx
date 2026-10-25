import { useEffect, useRef, useCallback, useState } from 'react';
import { validateWhiteboardNodeCount } from '@dailyways/limits';
import { resolveLimitError } from '../../../limits/messages.js';
import { useToast } from '../../../context/useToast';
import { useAuth } from '../../../context/useAuth';
import { WhiteboardViewportProvider } from '../interaction/viewport/WhiteboardViewportContext.jsx';
import { useWhiteboardStore } from '../../../stores/whiteboardStore';
import { useWhiteboardSelectionStore } from '../../../stores/whiteboardSelectionStore';
import { useWhiteboardDocumentStore } from '../../../stores/whiteboardDocumentStore';
import { fetchRulerGuides } from '../../../services/whiteboardService';
import { useCanvasShortcuts } from '../interaction/hooks/useCanvasShortcuts';
import { isDragCreationTool as checkDragCreationTool } from '../interaction/hooks/useCreateTool';
import { useResizeRotateState } from '../interaction/hooks/useResizeRotate';
import PresenceLayer from '../../../collab/board/ui/PresenceLayer.jsx';
import { useCollabPatch } from '../../../collab/space/ops/useCollabPatch';
import { useCollabPresence } from '../../../collab/board/presence/useCollabPresence.js';
import SpaceRemoteDragLayer from '../../../collab/space/ui/SpaceRemoteDragLayer.jsx';
import NodeLayer from './NodeLayer';
import TransformHandlesLayer from './overlays/TransformHandlesLayer';
import ConnectorLayer from './ConnectorLayer';
import SelectionManager from './overlays/SelectionManager';
import RulersOverlay from './overlays/RulersOverlay';
import RulerGuidesOverlay from './overlays/RulerGuidesOverlay';
import { useRulerGuideInteraction } from '../interaction/hooks/useRulerGuideInteraction';
import { computeViewportToFitNodes } from '../interaction/viewport/viewportFit';
import { getInspectorInsetPx } from '../shared/inspectorLayout';
import { patchZIndexSelected } from '../core/ops/whiteboardNodeOps';
import ShortcutsHelp from '../panels/ShortcutsHelp';
import SnapGuidesOverlay from './overlays/SnapGuidesOverlay';
import InspectorPanel from '../panels/InspectorPanel';
import { snapGuidesEqual } from '../interaction/snap/whiteboardSnap';
import { groupSelectedNodes, ungroupSelectedNodes } from '../core/layers/whiteboardGroupOps';
import ViewportControlsBar from '../panels/ViewportControlsBar';
import WhiteboardBottomChrome from '../panels/WhiteboardBottomChrome';
import LeftToolbar from '../panels/LeftToolbar';
import DraggablePanel from '../panels/DraggablePanel';
import WhiteboardContextMenu from '../panels/WhiteboardContextMenu';
import './CanvasShell.css';
import { NODE_TYPES_ALLOWED } from '../shared/constants';
import { useNodeCreation } from './hooks/useNodeCreation';
import { useCanvasUploads } from './hooks/useCanvasUploads';
import { useCanvasClipboard } from './hooks/useCanvasClipboard';
import { useResizeRotate } from './hooks/useResizeRotate';
import { useSelectionActions } from './hooks/useSelectionActions';
import { useNodeDrag } from './hooks/useNodeDrag';
import { useCanvasPointerDown } from './hooks/useCanvasPointerDown';
import { useCanvasPointerGestures } from './hooks/useCanvasPointerGestures';
import { useCanvasContextMenu } from './hooks/useCanvasContextMenu';
import { useFreehandDraw } from './hooks/useFreehandDraw';
import PenBar from '../panels/PenBar';

export default function CanvasEngine({ spaceId, space, onViewportChange, onRegisterViewportControl }) {
    const containerRef = useRef(null);
    const [selectionBox, setSelectionBox] = useState(null);
    const [createPreview, setCreatePreview] = useState(null);
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    const { resizeActiveRef, resizeState, setResizeState, rotateState, setRotateState } =
        useResizeRotateState();
    const [contextMenuPosition, setContextMenuPosition] = useState(null);
    const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
    const [snapGuides, setSnapGuides] = useState([]);
    const snapGuidesRef = useRef([]);
    const setSnapGuidesIfChanged = useCallback((guides) => {
        const next = guides ?? [];
        if (snapGuidesEqual(snapGuidesRef.current, next)) return;
        snapGuidesRef.current = next;
        setSnapGuides(next);
    }, []);
    const pendingUploadWorldPositionRef = useRef(null);
    const openImagePickerRef = useRef(null);
    const openFilePickerRef = useRef(null);
    const nodeDragRef = useRef(null);
    const createDragRef = useRef(null);
    const rightMousePanRef = useRef(false);
    /** Ctrl/Cmd mantido ao soltar o ponteiro → conserva a ferramenta de criação ativa. */
    const keepCreationToolRef = useRef(false);
    const viewportRef = useRef(null);
    const lastPointerClientRef = useRef(null);
    const initialPan = { x: space?.panX ?? 0, y: space?.panY ?? 0 };
    const initialZoom = space?.zoom ?? 1;
    const [isMobile, setIsMobile] = useState(
        () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
    );
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 768px)');
        const onChange = () => setIsMobile(mq.matches);
        onChange();
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    const { user } = useAuth();
    const { addToast } = useToast();
    const guardNodeLimit = useCallback((adding = 1) => {
        const count = useWhiteboardDocumentStore.getState().nodes?.length ?? 0;
        const err = validateWhiteboardNodeCount(count, adding);
        if (err) {
            addToast(resolveLimitError(err), 'error');
            return false;
        }
        return true;
    }, [addToast]);
    const {
        collabPatchNode,
        collabPatchNodes,
        collabCreateNode,
        collabCreateConnector,
        collabDeleteNodes,
        connected: collabConnected,
    } = useCollabPatch();
    const { updateCursor, updateSelection, updateDragPreview } = useCollabPresence(spaceId, { scope: 'space' });
    const collabPatchNodeRef = useRef(collabPatchNode);
    const collabPatchNodesRef = useRef(collabPatchNodes);
    const updateDragPreviewRef = useRef(updateDragPreview);
    const setSnapGuidesIfChangedRef = useRef(setSnapGuidesIfChanged);
    collabPatchNodeRef.current = collabPatchNode;
    collabPatchNodesRef.current = collabPatchNodes;
    updateDragPreviewRef.current = updateDragPreview;
    setSnapGuidesIfChangedRef.current = setSnapGuidesIfChanged;
    const {
        setSelection,
        setActiveTool,
        activeTool,
        connectorFromNodeId,
        setConnectorFromNodeId,
        selectedNodeIds,
        gridVisible,
        setGridVisible,
        rulersVisible,
        setRulersVisible,
        guidesVisible,
        setGuidesVisible,
        snapEnabled,
        setSnapEnabled,
        inspectorPanelOpen,
        setInspectorPanelOpen,
        setViewport: setStoreViewport,
        clearGuideSelection,
    } = useWhiteboardSelectionStore();

    const {
        guideCreatePreview,
        guideSnapGuides,
        pageGuides,
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
    } = useRulerGuideInteraction({
        containerRef,
        viewportRef,
        collabConnected,
        spaceId,
    });

    const isDragCreationTool = (tool) => checkDragCreationTool(tool, NODE_TYPES_ALLOWED);

    const {
        createNodeAt,
        applyCreateDragBox,
    } = useNodeCreation({
        spaceId,
        containerRef,
        createPreview,
        setCreatePreview,
        createDragRef,
        viewportRef,
        lastPointerClientRef,
        user,
        collabPatchNode,
        collabCreateNode,
        collabConnected,
    });

    const [pen, setPen] = useState(() => {
        try {
            const v = JSON.parse(localStorage.getItem('dailyways_pen') || 'null');
            if (v?.color && v?.size) return v;
        } catch { /* padrão abaixo */ }
        return { color: '#8b5cf6', size: 4 };
    });
    const changePen = useCallback((next) => {
        setPen(next);
        try { localStorage.setItem('dailyways_pen', JSON.stringify(next)); } catch { /* só não lembra */ }
    }, []);
    const freehandPreviewRef = useFreehandDraw({
        containerRef,
        viewportRef,
        active: activeTool === 'draw',
        isSpacePressed,
        createNodeAt,
        pen,
    });

    const {
        getViewportCenterWorld,
        handleUploadImage,
        handleUploadFile,
    } = useCanvasUploads({
        spaceId,
        containerRef,
        pendingUploadWorldPositionRef,
        viewportRef,
        user,
        addToast,
        guardNodeLimit,
        collabCreateNode,
        collabConnected,
    });

    const {
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
    } = useCanvasClipboard({
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
    });

    useCanvasShortcuts({
        containerRef,
        collabConnected,
        collabDeleteNodes,
        collabPatchNodes,
        performUndo,
        performRedo,
        handleCut,
        handleCopy,
        handlePaste,
        handlePasteInPlace,
        handleDuplicate,
        setRulersVisible,
        setGridVisible,
        handleDeleteSelectedGuides,
        handleToggleGuideLock,
        setActiveTool,
        setConnectorFromNodeId,
        viewportState,
        getZoomFocalClient,
        commitTextEdit,
        setIsSpacePressed,
        setShortcutsHelpOpen,
        setContextMenuPosition,
    });
    const viewportForChildren = {
        panX: viewportState.pan.x,
        panY: viewportState.pan.y,
        zoom: viewportState.zoom,
    };
    viewportRef.current = viewportForChildren;

    useEffect(() => {
        setStoreViewport({ panX: viewportState.pan.x, panY: viewportState.pan.y, zoom: viewportState.zoom });
    }, [viewportState.pan.x, viewportState.pan.y, viewportState.zoom, setStoreViewport]);

    useEffect(() => {
        if (!spaceId) return;
        useWhiteboardDocumentStore.getState().setSpaceId(spaceId);
        viewportState.setViewport(initialPan, initialZoom);
        setStoreViewport({ panX: initialPan.x, panY: initialPan.y, zoom: initialZoom });
        fetchRulerGuides(spaceId).then(({ data }) => {
            useWhiteboardDocumentStore.getState().setRulerGuides(data || []);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao trocar de space
    }, [spaceId]);

    // Ao abrir: vista nunca ajustada (0,0 a 100%) ou nenhum elemento ao menos metade na tela
    // (vista salva em outra tela/tamanho) → enquadra o conteúdo. Uma vez por space.
    const autoFitSpaceRef = useRef(null);
    const setViewportForFit = viewportState.setViewport;
    useEffect(() => {
        if (!spaceId) return undefined;
        const tryFit = () => {
            if (autoFitSpaceRef.current === spaceId) return true;
            const doc = useWhiteboardDocumentStore.getState();
            if (doc.spaceId !== spaceId) return false;
            const nodes = useWhiteboardStore.getState().nodes || [];
            // o inspetor fica ao lado (flex), fora do retângulo do viewport
            const rect = containerRef.current?.getBoundingClientRect();
            if (!nodes.length || !rect?.width) return false;
            autoFitSpaceRef.current = spaceId;
            const { panX, panY, zoom } = viewportRef.current || { panX: 0, panY: 0, zoom: 1 };
            const neverAdjusted = !panX && !panY && zoom === 1;
            const mostlyVisible = (n) => {
                const w = (n.width ?? 0) * zoom;
                const h = (n.height ?? 0) * zoom;
                if (w <= 0 || h <= 0) return false;
                const left = rect.width / 2 + panX + (n.x ?? 0) * zoom;
                const top = rect.height / 2 + panY + (n.y ?? 0) * zoom;
                const visW = Math.max(0, Math.min(left + w, rect.width) - Math.max(left, 0));
                const visH = Math.max(0, Math.min(top + h, rect.height) - Math.max(top, 0));
                return (visW * visH) / (w * h) >= 0.5;
            };
            if (!neverAdjusted && nodes.some(mostlyVisible)) return true;
            const fit = computeViewportToFitNodes(nodes, rect, 160);
            const zoomFit = Math.min(fit.zoom, 1);
            const scale = zoomFit / fit.zoom;
            setViewportForFit({ x: fit.pan.x * scale, y: fit.pan.y * scale }, zoomFit);
            return true;
        };
        if (tryFit()) return undefined;
        const unsub = useWhiteboardDocumentStore.subscribe(() => {
            if (tryFit()) unsub();
        });
        return unsub;
    }, [spaceId, setViewportForFit]);

    const setViewportState = viewportState.setViewport;
    useEffect(() => {
        if (!onRegisterViewportControl) return undefined;
        const resetViewport = () => setViewportState({ x: 0, y: 0 }, 1);
        onRegisterViewportControl({ resetViewport });
        return () => onRegisterViewportControl(null);
    }, [onRegisterViewportControl, setViewportState]);

    useEffect(() => {
        updateSelection(selectedNodeIds);
    }, [selectedNodeIds, updateSelection]);

    useEffect(() => () => {
        updateDragPreview({ draggingNodeIds: [], dragPreviewRects: [] });
    }, [updateDragPreview]);

    const isCanvasBackground = (e) =>
        !e.target?.closest?.('.whiteboard-node-wrapper') &&
        !e.target?.closest?.('.whiteboard-transform-overlay') &&
        !e.target?.closest?.('.whiteboard-resize-handles') &&
        !e.target?.closest?.('.whiteboard-resize-handle') &&
        !e.target?.closest?.('.whiteboard-rotate-handle') &&
        !e.target?.closest?.('.whiteboard-viewport-controls') &&
        !e.target?.closest?.('.whiteboard-bottom-dock') &&
        !e.target?.closest?.('.whiteboard-bottom-chrome') &&
        !e.target?.closest?.('.whiteboard-ruler-guide') &&
        !e.target?.closest?.('.whiteboard-rulers-horizontal') &&
        !e.target?.closest?.('.whiteboard-rulers-vertical');

    const {
        handlePointerDown,
    } = useCanvasPointerDown({
        containerRef,
        setSelectionBox,
        setCreatePreview,
        isSpacePressed,
        createDragRef,
        rightMousePanRef,
        activeTool,
        clearGuideSelection,
        tryPickGuideOnBackground,
        isDragCreationTool,
        viewportState,
        commitTextEdit,
        viewportForChildren,
        isCanvasBackground,
    });

    const {
        handleResizeStart,
        handleRotateStart,
        COLORABLE_TYPES,
    } = useResizeRotate({
        containerRef,
        resizeActiveRef,
        resizeState,
        setResizeState,
        rotateState,
        setRotateState,
        nodeDragRef,
        viewportRef,
        collabPatchNodeRef,
        collabPatchNodesRef,
        setSnapGuidesIfChangedRef,
    });

    const {
        openSelectionContextMenu,
        handleDownloadSelectedImages,
        handleDeleteSelection,
        handleSelectionColor,
        handleNodeContextMenu,
    } = useSelectionActions({
        setContextMenuPosition,
        collabPatchNode,
        collabDeleteNodes,
        collabConnected,
        setSelection,
        handleDeleteSelectedGuides,
        COLORABLE_TYPES,
    });

    const {
        handleNodePointerDown,
    } = useNodeDrag({
        spaceId,
        containerRef,
        setCreatePreview,
        resizeActiveRef,
        nodeDragRef,
        createDragRef,
        viewportRef,
        collabCreateConnector,
        collabConnected,
        collabPatchNodeRef,
        collabPatchNodesRef,
        updateDragPreviewRef,
        setSnapGuidesIfChangedRef,
        activeTool,
        connectorFromNodeId,
        setConnectorFromNodeId,
        isDragCreationTool,
        commitTextEdit,
        viewportForChildren,
    });

    const {
        handlePointerUp,
        handlePointerMove,
    } = useCanvasPointerGestures({
        containerRef,
        selectionBox,
        setSelectionBox,
        setCreatePreview,
        createDragRef,
        rightMousePanRef,
        keepCreationToolRef,
        viewportRef,
        lastPointerClientRef,
        updateCursor,
        setSelection,
        activeTool,
        clearGuideSelection,
        createNodeAt,
        applyCreateDragBox,
        viewportState,
        viewportForChildren,
    });

    const {
        handleContextMenu,
        handleContextMenuCreate,
        handleContextMenuUploadImage,
        handleContextMenuUploadFile,
        handleDragOver,
        handleDrop,
    } = useCanvasContextMenu({
        spaceId,
        containerRef,
        contextMenuPosition,
        setContextMenuPosition,
        pendingUploadWorldPositionRef,
        openImagePickerRef,
        openFilePickerRef,
        rightMousePanRef,
        viewportRef,
        user,
        addToast,
        guardNodeLimit,
        collabCreateNode,
        collabConnected,
        activeTool,
        guidesVisible,
        createNodeAt,
        viewportForChildren,
        openSelectionContextMenu,
    });

    return (
        <>
            <div
                className="whiteboard-editor-layout"
                style={{ '--inspector-inset': `${getInspectorInsetPx(inspectorPanelOpen)}px` }}
            >
                <div className="whiteboard-canvas-column">
                <div
                    className={`whiteboard-viewport ${activeTool === 'draw' ? 'tool-draw' : ''} ${viewportState.isPanning ? 'panning' : ''} ${isSpacePressed ? 'space-pressed' : ''} ${!gridVisible ? 'grid-hidden' : ''} ${rulersVisible ? 'rulers-visible' : ''}`}
                    ref={containerRef}
                    tabIndex={-1}
                onWheel={viewportState.handleWheel}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onDragStart={(e) => {
                    if (e.target?.closest?.('.whiteboard-node-wrapper')) e.preventDefault();
                }}
                onContextMenu={handleContextMenu}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onPaste={handleViewportPaste}
                style={{
                    backgroundSize: `${24 * viewportState.zoom}px ${24 * viewportState.zoom}px`,
                    backgroundPosition: `${viewportState.pan.x % (24 * viewportState.zoom)}px ${viewportState.pan.y % (24 * viewportState.zoom)}px`,
                }}
            >
                <WhiteboardViewportProvider zoom={viewportState.zoom}>
                <div
                    className="whiteboard-canvas-transform"
                    style={viewportState.transformStyle}
                >
                    <ConnectorLayer />
                    <SnapGuidesOverlay
                        guides={
                            guideSnapGuides.length
                                ? [...snapGuides, ...guideSnapGuides]
                                : snapGuides
                        }
                    />
                    {activeTool === 'draw' && (
                        <svg className="whiteboard-freehand-preview" aria-hidden>
                            <path ref={freehandPreviewRef} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    )}
                    <div className="whiteboard-nodes-container">
                        <NodeLayer
                            viewport={viewportForChildren}
                            containerRef={containerRef}
                            onNodePointerDown={handleNodePointerDown}
                            onNodeContextMenu={handleNodeContextMenu}
                        />
                    </div>
                    {(guidesVisible || guideCreatePreview) && (
                        <RulerGuidesOverlay
                            guides={pageGuides}
                            selectedGuideIds={selectedGuideIds}
                            lockedGuideIds={lockedGuideIds}
                            preview={guideCreatePreview}
                            onGuidePointerDown={handleGuidePointerDown}
                        />
                    )}
                </div>
                <div className="whiteboard-screen-overlays" aria-hidden={false}>
                    <SelectionManager
                        selectionBox={selectionBox}
                        createPreview={createPreview}
                        viewport={viewportForChildren}
                        containerRef={containerRef}
                    />
                    {!selectionBox && (
                        <TransformHandlesLayer
                            viewport={viewportForChildren}
                            containerRef={containerRef}
                            onResizeStart={handleResizeStart}
                            onRotateStart={handleRotateStart}
                        />
                    )}
                </div>
                </WhiteboardViewportProvider>
                <PresenceLayer viewport={viewportForChildren} worldContainerRef={containerRef} />
                <SpaceRemoteDragLayer viewport={viewportForChildren} worldContainerRef={containerRef} />
                {rulersVisible && (
                    <RulersOverlay
                        viewport={viewportForChildren}
                        containerRef={containerRef}
                        interactive
                        onRulerPointerDown={handleRulerPointerDown}
                    />
                )}
                {isMobile && (
                    <ViewportControlsBar
                        viewportState={viewportState}
                        gridVisible={gridVisible}
                        setGridVisible={setGridVisible}
                        rulersVisible={rulersVisible}
                        setRulersVisible={setRulersVisible}
                        guidesVisible={guidesVisible}
                        setGuidesVisible={setGuidesVisible}
                        snapEnabled={snapEnabled}
                        setSnapEnabled={setSnapEnabled}
                        setSnapGuidesIfChangedRef={setSnapGuidesIfChangedRef}
                        getZoomFocalClient={getZoomFocalClient}
                        onOpenShortcuts={() => setShortcutsHelpOpen(true)}
                    />
                )}
            </div>
                {activeTool === 'draw' && <PenBar pen={pen} onChange={changePen} />}
                {!isMobile && (
                    <WhiteboardBottomChrome
                        toolbarProps={{
                            onUploadImage: handleUploadImage,
                            onUploadFile: handleUploadFile,
                            registerOpenImagePicker: (fn) => {
                                openImagePickerRef.current = fn;
                            },
                            registerOpenFilePicker: (fn) => {
                                openFilePickerRef.current = fn;
                            },
                        }}
                        viewportControlsProps={{
                            viewportState,
                            gridVisible,
                            setGridVisible,
                            rulersVisible,
                            setRulersVisible,
                            guidesVisible,
                            setGuidesVisible,
                            snapEnabled,
                            setSnapEnabled,
                            setSnapGuidesIfChangedRef,
                            getZoomFocalClient,
                            onOpenShortcuts: () => setShortcutsHelpOpen(true),
                        }}
                    />
                )}
                </div>
                <InspectorPanel
                    spaceId={spaceId}
                    spaceTitle={space?.name || space?.title || 'Space'}
                    open={inspectorPanelOpen}
                    onToggle={() => setInspectorPanelOpen(!inspectorPanelOpen)}
                />
            </div>
            <ShortcutsHelp open={shortcutsHelpOpen} onClose={() => setShortcutsHelpOpen(false)} />
            {isMobile && (
                <DraggablePanel
                    id="whiteboard-toolbar"
                    className="whiteboard-toolbar-panel"
                    defaultBottom={76}
                    hideHandle
                    style={{ left: 12, right: 12, transform: 'none' }}
                >
                    <LeftToolbar
                        onUploadImage={handleUploadImage}
                        onUploadFile={handleUploadFile}
                        registerOpenImagePicker={(fn) => {
                            openImagePickerRef.current = fn;
                        }}
                        registerOpenFilePicker={(fn) => {
                            openFilePickerRef.current = fn;
                        }}
                        variant="bottom"
                    />
                </DraggablePanel>
            )}
            <WhiteboardContextMenu
                position={contextMenuPosition}
                onClose={() => setContextMenuPosition(null)}
                onCreateNode={handleContextMenuCreate}
                onUploadImage={handleContextMenuUploadImage}
                onUploadFile={handleContextMenuUploadFile}
                onGroup={() => groupSelectedNodes(useWhiteboardStore, collabPatchNodes)}
                onUngroup={() =>
                    ungroupSelectedNodes(useWhiteboardStore, collabPatchNodes, collabDeleteNodes)
                }
                onBringToFront={() =>
                    patchZIndexSelected(useWhiteboardStore, collabPatchNodes, 'front')
                }
                onSendToBack={() => patchZIndexSelected(useWhiteboardStore, collabPatchNodes, 'back')}
                onDuplicate={handleDuplicate}
                onDelete={handleDeleteSelection}
                onColorChange={handleSelectionColor}
                onDownloadImage={handleDownloadSelectedImages}
                onToggleGuideLock={handleToggleGuideLock}
                showColorPicker={contextMenuPosition?.showColorPicker}
                showDownloadImage={contextMenuPosition?.showDownloadImage}
                guideAllLocked={contextMenuPosition?.guideAllLocked}
            />
        </>
    );
}
