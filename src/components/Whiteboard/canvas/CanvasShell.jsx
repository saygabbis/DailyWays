import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useViewport } from '../interaction/hooks/useViewport';
import { useWhiteboardStore } from '../../../stores/whiteboardStore';
import { getDefaultNodePayload, isCreationTool } from '../../../stores/whiteboardStore';
import { insertNode, insertConnector, uploadSpaceAsset, deleteNode as deleteNodeService } from '../../../services/whiteboardService';
import { useWhiteboardUndo } from '../interaction/hooks/useWhiteboardUndo';
import { useCanvasShortcuts } from '../interaction/hooks/useCanvasShortcuts';
import {
    CREATION_DRAG_TOOLS,
    CREATE_DRAG_THRESHOLD_PX,
    CREATE_MIN_SIZE,
    creationToolToNodeType,
    isDragCreationTool as checkDragCreationTool,
} from '../interaction/hooks/useCreateTool';
import { useResizeRotateState } from '../interaction/hooks/useResizeRotate';
import PresenceLayer from '../../../collab/board/ui/PresenceLayer.jsx';
import { useCollabPatch } from '../../../collab/whiteboard/CollabOpsContext.jsx';
import { useCollabPresence } from '../../../collab/board/presence/useCollabPresence.js';
import { screenToWorldWithContainer, worldToScreenWithContainer, rectIntersects, findContainerAt } from '../interaction/viewport/viewportUtils';
import { computeResizeBounds } from '../interaction/transform/resizeBounds';
import { computeSkewResizeBounds } from '../interaction/transform/resizeSkew';
import { worldBoxFromAnchor } from '../interaction/transform/createDragBounds';
import NodeLayer from './NodeLayer';
import SelectionTransformOverlay from './overlays/SelectionTransformOverlay';
import ConnectorLayer from './ConnectorLayer';
import SelectionManager from './overlays/SelectionManager';
import ResizeHandles from './overlays/ResizeHandles';
import RulersOverlay from './overlays/RulersOverlay';
import { captureNodesSnapshot, cloneNode } from '../core/history/whiteboardHistory';
import { filterNodesByPage } from '../core/pages/whiteboardPages';
import { getInspectorInsetPx } from '../shared/inspectorLayout';
import { getNodeCenterWorld, pointerWorldAngleDeg, computeRotationFromPointer } from '../interaction/transform/rotatePointer';
import {
    copyNodesToClipboard,
    setClipboardFromNodes,
    duplicateSelectedNodes,
    pasteFromClipboard,
    nudgeSelectedNodes,
    patchZIndexSelected,
} from '../core/ops/whiteboardNodeOps';
import { computeViewportToFitNodes } from '../interaction/viewport/viewportFit';
import ShortcutsHelp from '../panels/ShortcutsHelp';
import SnapGuidesOverlay from './overlays/SnapGuidesOverlay';
import InspectorPanel from '../panels/InspectorPanel';
import { computeSnapForDrag, computeSnapForResize } from '../interaction/snap/whiteboardSnap';
import { nodeToWorld, worldTopLeftToNodePatch, buildNodesById } from '../core/ops/whiteboardNodeOps';
import { resolveDragNodeIds } from '../core/selection/whiteboardSelectionUtils';
import { getNodeCreateOffset } from '../core/whiteboardCreateOffsets';
import {
    groupSelectedNodes,
    ungroupSelectedNodes,
    getSelectionContextFlags,
} from '../core/layers/whiteboardGroupOps';
import {
    SELECTION_TRANSFORM_ID,
    getTransformTargetIds,
    getUnifiedSelectionBox,
    computeMultiResizePatches,
    computeMultiRotatePatches,
    getSelectionTransformCenter,
} from '../interaction/transform/selectionTransform';
import { getSelectionWorldBounds } from '../core/align/whiteboardAlign';
import { contrastingTextColor } from '../../../utils/contrastingTextColor';
import { recordNodesMutation } from '../core/history/whiteboardHistory';
import LeftToolbar from '../panels/LeftToolbar';
import DraggablePanel from '../panels/DraggablePanel';
import WhiteboardContextMenu from '../panels/WhiteboardContextMenu';
import { Grid3X3, ZoomIn, ZoomOut, Ruler, Magnet, HelpCircle, Focus } from 'lucide-react';
import { uuidv4 } from '../../../utils/uuid';
import { applyPostCreateActions } from '../core/creation/postCreateActions';
import './CanvasShell.css';

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
    const pendingUploadWorldPositionRef = useRef(null);
    const openImagePickerRef = useRef(null);
    const openFilePickerRef = useRef(null);
    const nodeDragRef = useRef(null);
    const createDragRef = useRef(null);
    /** Ctrl/Cmd mantido ao soltar o ponteiro → conserva a ferramenta de criação ativa. */
    const keepCreationToolRef = useRef(false);
    const viewportRef = useRef(null);
    const lastPointerClientRef = useRef(null);
    const initialPan = { x: space?.panX ?? 0, y: space?.panY ?? 0 };
    const initialZoom = space?.zoom ?? 1;
    const isMobile = typeof window !== 'undefined' ? window.innerWidth <= 768 : false;

    const { user } = useAuth();
    const {
        collabPatchNode,
        collabPatchNodes,
        collabCreateNode,
        collabCreateConnector,
        collabDeleteNodes,
        connected: collabConnected,
    } = useCollabPatch();
    const { updateCursor, updateSelection } = useCollabPresence(spaceId);
    const {
        setSpaceId,
        setViewport: setStoreViewport,
        setSelection,
        addNode,
        addConnector,
        setActiveTool,
        activeTool,
        connectorFromNodeId,
        setConnectorFromNodeId,
        nodes,
        connectors,
        selectedNodeIds,
        gridVisible,
        setGridVisible,
        rulersVisible,
        setRulersVisible,
        snapEnabled,
        setSnapEnabled,
        inspectorPanelOpen,
        setInspectorPanelOpen,
        pushHistory,
    } = useWhiteboardStore();

    const NODE_TYPES_ALLOWED = ['sticky_note', 'text', 'shape', 'frame', 'image', 'comment', 'link', 'todo_list', 'file_card', 'drawing', 'column', 'table'];

    const isDragCreationTool = (tool) => checkDragCreationTool(tool, NODE_TYPES_ALLOWED);

    const createNodeAt = useCallback(
        async (type, worldX, worldY, extraData = {}, dims) => {
            if (!spaceId || !NODE_TYPES_ALLOWED.includes(type)) return null;
            const defaultKey = type === 'drawing' ? 'draw' : type === 'file_card' ? 'file' : type;
            const payload = getDefaultNodePayload(defaultKey, worldX, worldY);
            payload.type = type;
            const pageId = useWhiteboardStore.getState().activePageId;
            Object.assign(payload.data, extraData.data || {}, { pageId });
            if (extraData.style) Object.assign(payload.style, extraData.style);
            if (dims?.width != null) payload.width = Math.max(CREATE_MIN_SIZE, dims.width);
            if (dims?.height != null) payload.height = Math.max(CREATE_MIN_SIZE, dims.height);
            const allNodes = useWhiteboardStore.getState().nodes;
            const pageNodes = filterNodesByPage(allNodes, pageId);
            const centerX = worldX + (payload.width ?? 0) / 2;
            const centerY = worldY + (payload.height ?? 0) / 2;
            const container = findContainerAt(pageNodes, centerX, centerY);
            if (container) {
                payload.parentId = container.id;
                payload.x = worldX - container.x;
                payload.y = worldY - container.y;
            }
            if (collabConnected) {
                collabCreateNode({ ...payload, createdBy: user?.id ?? null });
            } else {
                const res = await insertNode(spaceId, payload, user?.id);
                if (res.success) {
                    addNode(payload);
                } else {
                    return null;
                }
            }
            useWhiteboardStore.getState().pushHistory({
                type: 'node_add',
                payload: { node: cloneNode({ ...payload, createdBy: user?.id ?? null }) },
            });
            return payload.id;
        },
        [spaceId, user?.id, addNode, collabCreateNode, collabConnected]
    );

    const applyCreateDragBox = useCallback(
        async (drag, currentWorld) => {
            const box = worldBoxFromAnchor(drag.anchorWorld, currentWorld, CREATE_MIN_SIZE);
            const nodeType = creationToolToNodeType(drag.tool);
            if (!drag.nodeId) {
                if (!drag._initPromise) {
                    drag._initPromise = createNodeAt(nodeType, box.x, box.y, {}, {
                        width: box.width,
                        height: box.height,
                    }).then((id) => {
                        if (id) drag.nodeId = id;
                        return id;
                    });
                }
                await drag._initPromise;
            }
            if (drag.nodeId) {
                collabPatchNode(drag.nodeId, {
                    x: box.x,
                    y: box.y,
                    width: box.width,
                    height: box.height,
                });
            }
        },
        [createNodeAt, collabPatchNode]
    );

    const getViewportCenterWorld = useCallback(() => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect || !viewportRef.current) return { x: 0, y: 0 };
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        return screenToWorldWithContainer(cx, cy, rect, viewportRef.current);
    }, []);

    const handleUploadImage = useCallback(
        async (file) => {
            if (!spaceId || !file) return;
            if (!file.type?.startsWith('image/')) {
                console.warn('[CanvasEngine] handleUploadImage: not an image file', file.name);
                return;
            }
            try {
                const result = await uploadSpaceAsset(spaceId, file, user?.id);
                if (!result.url) {
                    console.error('[CanvasEngine] upload image failed', result.error);
                    return;
                }
                let place = pendingUploadWorldPositionRef.current;
                if (place) pendingUploadWorldPositionRef.current = null;
                else {
                    const center = getViewportCenterWorld();
                    place = { x: center.x - 100, y: center.y - 75 };
                }
                const sizeStr = file.size != null ? (file.size < 1024 ? `${file.size} B` : file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`) : '';
                const payload = getDefaultNodePayload('image', place.x, place.y);
                Object.assign(payload.data, { url: result.url, filename: file.name, size: sizeStr });
                if (collabConnected) {
                    collabCreateNode({ ...payload, createdBy: user?.id ?? null });
                } else {
                    const res = await insertNode(spaceId, payload, user?.id);
                    if (res.success) addNode(payload);
                }
            } catch (err) {
                console.error('[CanvasEngine] handleUploadImage error', err);
            }
        },
        [spaceId, user?.id, addNode, collabCreateNode, collabConnected, getViewportCenterWorld]
    );

    const handleUploadFile = useCallback(
        async (file) => {
            if (!spaceId || !file) return;
            try {
                const result = await uploadSpaceAsset(spaceId, file, user?.id);
                if (!result.url) {
                    console.error('[CanvasEngine] upload file failed', result.error);
                    return;
                }
                let place = pendingUploadWorldPositionRef.current;
                if (place) pendingUploadWorldPositionRef.current = null;
                else {
                    const center = getViewportCenterWorld();
                    const isImg = file.type?.startsWith('image/');
                    place = { x: center.x - (isImg ? 100 : 110), y: center.y - (isImg ? 75 : 40) };
                }
                const sizeStr = file.size != null ? (file.size < 1024 ? `${file.size} B` : file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`) : '';
                const isImage = file.type?.startsWith('image/');
                const type = isImage ? 'image' : 'file_card';
                const payload = getDefaultNodePayload(type, place.x, place.y);
                Object.assign(payload.data, { url: result.url, filename: file.name, size: sizeStr });
                if (collabConnected) {
                    collabCreateNode({ ...payload, createdBy: user?.id ?? null });
                } else {
                    const res = await insertNode(spaceId, payload, user?.id);
                    if (res.success) addNode(payload);
                }
            } catch (err) {
                console.error('[CanvasEngine] handleUploadFile error', err);
            }
        },
        [spaceId, user?.id, addNode, collabCreateNode, collabConnected, getViewportCenterWorld]
    );

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
            addNode,
            pushHistory,
            store: useWhiteboardStore,
        }),
        [spaceId, user?.id, collabCreateNode, collabConnected, addNode, pushHistory]
    );

    const handleCopy = useCallback(() => {
        copyNodesToClipboard(useWhiteboardStore);
    }, []);

    const handlePaste = useCallback(async () => {
        await pasteFromClipboard(nodeOpsCtx());
    }, [nodeOpsCtx]);

    const handlePasteInPlace = useCallback(async () => {
        await pasteFromClipboard(nodeOpsCtx(), { inPlace: true });
    }, [nodeOpsCtx]);

    const handleDuplicate = useCallback(async () => {
        await duplicateSelectedNodes(nodeOpsCtx());
    }, [nodeOpsCtx]);

    const handleCut = useCallback(() => {
        const state = useWhiteboardStore.getState();
        if (!state.selectedNodeIds.length) return;
        const selectedNodes = state.nodes.filter((n) => state.selectedNodeIds.includes(n.id));
        setClipboardFromNodes(useWhiteboardStore, selectedNodes);
        pushHistory({
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
    }, [pushHistory, collabConnected, collabDeleteNodes, setSelection]);

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
        setSpaceId(spaceId);
        viewportState.setViewport(initialPan, initialZoom);
        setStoreViewport({ panX: initialPan.x, panY: initialPan.y, zoom: initialZoom });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao trocar de space
    }, [spaceId]);

    useEffect(() => {
        if (!onRegisterViewportControl) return undefined;
        const resetViewport = () => {
            const pan = { x: 0, y: 0 };
            const zoom = 1;
            viewportState.setViewport(pan, zoom);
        };
        onRegisterViewportControl({ resetViewport });
        return () => onRegisterViewportControl(null);
    }, [onRegisterViewportControl, viewportState.setViewport]);

    useEffect(() => {
        updateSelection(selectedNodeIds);
    }, [selectedNodeIds, updateSelection]);

    const isCanvasBackground = (e) =>
        !e.target?.closest?.('.whiteboard-node-wrapper') &&
        !e.target?.closest?.('.whiteboard-transform-overlay') &&
        !e.target?.closest?.('.whiteboard-resize-handles') &&
        !e.target?.closest?.('.whiteboard-resize-handle') &&
        !e.target?.closest?.('.whiteboard-rotate-handle') &&
        !e.target?.closest?.('.whiteboard-viewport-controls');

    const handlePointerDown = useCallback(
        (e) => {
            if (e.button !== 0 && e.button !== 1) return;
            const isBg = isCanvasBackground(e);
            if (e.button === 1 || (e.button === 0 && isSpacePressed)) {
                e.preventDefault();
                e.stopPropagation();
                viewportState.handleMouseDown(e, isSpacePressed);
                if (e.currentTarget?.setPointerCapture) {
                    e.currentTarget.setPointerCapture(e.pointerId);
                }
                return;
            }
            if (e.button === 0 && isBg && !isSpacePressed) {
                e.preventDefault();
                containerRef.current?.focus?.({ preventScroll: true });
                commitTextEdit();
                if (activeTool === 'select') {
                    setSelectionBox({
                        start: { x: e.clientX, y: e.clientY },
                        current: { x: e.clientX, y: e.clientY },
                    });
                    if (e.currentTarget && typeof e.currentTarget.setPointerCapture === 'function') {
                        e.currentTarget.setPointerCapture(e.pointerId);
                    }
                } else if (isDragCreationTool(activeTool)) {
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (rect && viewportForChildren) {
                        const anchorWorld = screenToWorldWithContainer(
                            e.clientX,
                            e.clientY,
                            rect,
                            viewportForChildren
                        );
                        createDragRef.current = {
                            tool: activeTool,
                            anchorWorld,
                            startScreen: { x: e.clientX, y: e.clientY },
                            nodeId: null,
                            creating: false,
                        };
                        setCreatePreview({ anchorWorld, currentWorld: anchorWorld });
                    }
                    if (e.currentTarget && typeof e.currentTarget.setPointerCapture === 'function') {
                        e.currentTarget.setPointerCapture(e.pointerId);
                    }
                } else if (
                    isCreationTool(activeTool) &&
                    activeTool !== 'connector' &&
                    NODE_TYPES_ALLOWED.includes(creationToolToNodeType(activeTool))
                ) {
                    createDragRef.current = {
                        tool: activeTool,
                        clickOnly: true,
                        startScreen: { x: e.clientX, y: e.clientY },
                    };
                    if (e.currentTarget && typeof e.currentTarget.setPointerCapture === 'function') {
                        e.currentTarget.setPointerCapture(e.pointerId);
                    }
                }
            }
        },
        [viewportState, isSpacePressed, activeTool, commitTextEdit, viewportForChildren]
    );

    const handleResizeStart = useCallback((nodeId, corner, e) => {
        e.stopPropagation();
        e.preventDefault();
        nodeDragRef.current = null;
        resizeActiveRef.current = true;
        if (e.currentTarget?.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
        const state = useWhiteboardStore.getState();
        setRotateState(null);

        if (nodeId === SELECTION_TRANSFORM_ID) {
            const transformIds = getTransformTargetIds(state.selectedNodeIds, state.nodes);
            if (transformIds.length < 2) {
                resizeActiveRef.current = false;
                return;
            }
            const beforeSnapshots = captureNodesSnapshot(useWhiteboardStore, transformIds);
            if (!beforeSnapshots.length) {
                resizeActiveRef.current = false;
                return;
            }
            const box = getUnifiedSelectionBox(state.nodes, transformIds);
            if (!box) return;
            setResizeState({
                mode: 'selection',
                nodeIds: transformIds,
                corner,
                beforeSnapshots,
                origin: {
                    x: box.minX,
                    y: box.minY,
                    width: box.width,
                    height: box.height,
                },
            });
            return;
        }

        const node = state.nodes.find((n) => n.id === nodeId);
        if (!node) return;
        setResizeState({
            nodeId,
            corner,
            mode: e.ctrlKey ? 'skew' : 'resize',
            beforeNode: cloneNode(node),
            origin: {
                x: node.x,
                y: node.y,
                width: node.width ?? 0,
                height: node.height ?? 0,
                skewX: node.skewX ?? 0,
                skewY: node.skewY ?? 0,
            },
        });
    }, []);

    useEffect(() => {
        if (!resizeState) return;

        if (resizeState.mode === 'selection') {
            const { corner: handle, origin, beforeSnapshots, nodeIds } = resizeState;
            const onMove = (e) => {
                const rect = containerRef.current?.getBoundingClientRect();
                if (!rect || !viewportRef.current) return;
                const world = screenToWorldWithContainer(e.clientX, e.clientY, rect, viewportRef.current);
                const modifiers = { shiftKey: e.shiftKey, altKey: e.altKey, min: 0 };
                const newBox = computeResizeBounds(origin, handle, world, modifiers);
                const state = useWhiteboardStore.getState();
                const { box: snappedBox, guides } = computeSnapForResize({
                    box: newBox,
                    handle,
                    nodes: state.nodes,
                    movingIds: nodeIds,
                    zoom: viewportRef.current?.zoom ?? 1,
                    pageId: state.activePageId,
                    fromCenter: modifiers.altKey,
                    originForAspect: modifiers.shiftKey ? origin : null,
                    enabled: state.snapEnabled,
                });
                setSnapGuides(guides);
                const patches = computeMultiResizePatches(
                    beforeSnapshots,
                    state.nodes,
                    origin,
                    snappedBox
                );
                if (patches.length) collabPatchNodes(patches);
            };
            const onUp = () => {
                setSnapGuides([]);
                const before = resizeState.beforeSnapshots ?? [];
                const after = captureNodesSnapshot(useWhiteboardStore, nodeIds);
                const changed =
                    before.length > 0 &&
                    before.some((b, i) => {
                        const a = after[i];
                        if (!a) return true;
                        return JSON.stringify(b.node) !== JSON.stringify(a.node);
                    });
                if (changed) {
                    useWhiteboardStore.getState().pushHistory({
                        type: 'nodes_replace',
                        payload: { before, after },
                    });
                }
                resizeActiveRef.current = false;
                setResizeState(null);
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            return () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
            };
        }

        const { nodeId, corner: handle, origin, mode } = resizeState;
        const onMove = (e) => {
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect || !viewportRef.current) return;
            const world = screenToWorldWithContainer(e.clientX, e.clientY, rect, viewportRef.current);
            const modifiers = { shiftKey: e.shiftKey, altKey: e.altKey, min: 0 };
            if (mode === 'skew' || e.ctrlKey) {
                setSnapGuides([]);
                const patch = computeSkewResizeBounds(origin, handle, world, modifiers);
                collabPatchNode(nodeId, patch);
                return;
            }
            const patch = computeResizeBounds(origin, handle, world, modifiers);
            const state = useWhiteboardStore.getState();
            const node = state.nodes.find((n) => n.id === nodeId);
            if (!node) return;
            const byId = buildNodesById(state.nodes);
            const simulated = { ...node, ...patch };
            const worldPos = nodeToWorld(simulated, byId);
            const worldTop = nodeToWorld({ ...node, x: origin.x, y: origin.y }, byId);
            const worldOrigin = {
                x: worldTop.x,
                y: worldTop.y,
                width: origin.width ?? 0,
                height: origin.height ?? 0,
            };
            const worldBox = {
                x: worldPos.x,
                y: worldPos.y,
                width: patch.width ?? 0,
                height: patch.height ?? 0,
            };
            const { box: snappedBox, guides } = computeSnapForResize({
                box: worldBox,
                handle,
                nodes: state.nodes,
                movingIds: [nodeId],
                zoom: viewportRef.current?.zoom ?? 1,
                pageId: state.activePageId,
                fromCenter: modifiers.altKey,
                originForAspect: modifiers.shiftKey ? worldOrigin : null,
                enabled: state.snapEnabled,
            });
            setSnapGuides(guides);
            const finalPatch = worldTopLeftToNodePatch(node, snappedBox.x, snappedBox.y, state.nodes, {
                width: snappedBox.width,
                height: snappedBox.height,
            });
            collabPatchNode(nodeId, finalPatch);
        };
        const onUp = () => {
            setSnapGuides([]);
            const before = resizeState.beforeNode;
            const afterSnap = captureNodesSnapshot(useWhiteboardStore, [nodeId])[0];
            if (before && afterSnap?.node && JSON.stringify(before) !== JSON.stringify(afterSnap.node)) {
                useWhiteboardStore.getState().pushHistory({
                    type: 'nodes_replace',
                    payload: {
                        before: [{ id: nodeId, node: before }],
                        after: [{ id: nodeId, node: afterSnap.node }],
                    },
                });
            }
            resizeActiveRef.current = false;
            setResizeState(null);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
    }, [resizeState, collabPatchNode, collabPatchNodes]);

    const handleRotateStart = useCallback((nodeId, e) => {
        e.stopPropagation();
        e.preventDefault();
        nodeDragRef.current = null;
        resizeActiveRef.current = true;
        if (e.currentTarget?.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
        const state = useWhiteboardStore.getState();
        const rect = containerRef.current?.getBoundingClientRect();
        const vp = viewportRef.current;
        if (!rect || !vp) {
            resizeActiveRef.current = false;
            return;
        }
        const world = screenToWorldWithContainer(e.clientX, e.clientY, rect, vp);
        setResizeState(null);

        if (nodeId === SELECTION_TRANSFORM_ID) {
            const transformIds = getTransformTargetIds(state.selectedNodeIds, state.nodes);
            if (transformIds.length < 2) {
                resizeActiveRef.current = false;
                return;
            }
            const beforeSnapshots = captureNodesSnapshot(useWhiteboardStore, transformIds);
            const center = getSelectionTransformCenter(state.nodes, transformIds);
            setRotateState({
                mode: 'selection',
                nodeIds: transformIds,
                beforeSnapshots,
                center,
                startAngle: pointerWorldAngleDeg(center.x, center.y, world.x, world.y),
            });
            return;
        }

        const node = state.nodes.find((n) => n.id === nodeId);
        if (!node) return;
        const center = getNodeCenterWorld(node, state.nodes);
        setRotateState({
            nodeId,
            beforeNode: cloneNode(node),
            center,
            originRotation: node.rotation ?? 0,
            startAngle: pointerWorldAngleDeg(center.x, center.y, world.x, world.y),
        });
    }, []);

    useEffect(() => {
        if (!rotateState) return;

        if (rotateState.mode === 'selection') {
            const { center, startAngle, beforeSnapshots, nodeIds } = rotateState;
            const onMove = (e) => {
                const rect = containerRef.current?.getBoundingClientRect();
                if (!rect || !viewportRef.current) return;
                const world = screenToWorldWithContainer(e.clientX, e.clientY, rect, viewportRef.current);
                const currentAngle = pointerWorldAngleDeg(center.x, center.y, world.x, world.y);
                let delta = currentAngle - startAngle;
                if (e.shiftKey) {
                    delta = Math.round(delta / 15) * 15;
                }
                const state = useWhiteboardStore.getState();
                const patches = computeMultiRotatePatches(
                    beforeSnapshots,
                    state.nodes,
                    center,
                    delta
                );
                if (patches.length) collabPatchNodes(patches);
            };
            const onUp = () => {
                const before = rotateState.beforeSnapshots ?? [];
                const after = captureNodesSnapshot(useWhiteboardStore, nodeIds);
                const changed =
                    before.length > 0 &&
                    before.some((b, i) => {
                        const a = after[i];
                        if (!a) return true;
                        return JSON.stringify(b.node) !== JSON.stringify(a.node);
                    });
                if (changed) {
                    useWhiteboardStore.getState().pushHistory({
                        type: 'nodes_replace',
                        payload: { before, after },
                    });
                }
                resizeActiveRef.current = false;
                setRotateState(null);
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            return () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
            };
        }

        const { nodeId, center, originRotation, startAngle } = rotateState;
        const onMove = (e) => {
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect || !viewportRef.current) return;
            const world = screenToWorldWithContainer(e.clientX, e.clientY, rect, viewportRef.current);
            const currentAngle = pointerWorldAngleDeg(center.x, center.y, world.x, world.y);
            const rotation = computeRotationFromPointer(
                originRotation,
                startAngle,
                currentAngle,
                e.shiftKey
            );
            collabPatchNode(nodeId, { rotation });
        };
        const onUp = () => {
            const before = rotateState.beforeNode;
            const afterSnap = captureNodesSnapshot(useWhiteboardStore, [nodeId])[0];
            if (before && afterSnap?.node && JSON.stringify(before) !== JSON.stringify(afterSnap.node)) {
                useWhiteboardStore.getState().pushHistory({
                    type: 'nodes_replace',
                    payload: {
                        before: [{ id: nodeId, node: before }],
                        after: [{ id: nodeId, node: afterSnap.node }],
                    },
                });
            }
            resizeActiveRef.current = false;
            setRotateState(null);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
    }, [rotateState, collabPatchNode, collabPatchNodes]);

    const COLORABLE_TYPES = new Set(['sticky_note', 'text', 'shape', 'frame', 'comment']);

    const openSelectionContextMenu = useCallback((clientX, clientY) => {
        const st = useWhiteboardStore.getState();
        const prunedIds = resolveDragNodeIds(st.selectedNodeIds, st.nodes);
        const { canGroup, canUngroup } = getSelectionContextFlags(st.nodes, st.selectedNodeIds);
        const showColorPicker = st.nodes.some(
            (n) => prunedIds.includes(n.id) && COLORABLE_TYPES.has(n.type)
        );
        const showDownloadImage = st.nodes.some(
            (n) => prunedIds.includes(n.id) && n.type === 'image' && n.data?.url
        );
        setContextMenuPosition({
            left: clientX,
            top: clientY,
            mode: 'selection',
            canGroup,
            canUngroup,
            showColorPicker,
            showDownloadImage,
        });
    }, []);

    const handleDownloadSelectedImages = useCallback(() => {
        const st = useWhiteboardStore.getState();
        const ids = resolveDragNodeIds(st.selectedNodeIds, st.nodes);
        const images = st.nodes.filter(
            (n) => ids.includes(n.id) && n.type === 'image' && n.data?.url
        );
        for (const node of images) {
            const a = document.createElement('a');
            a.href = node.data.url;
            a.download = node.data.filename || 'imagem';
            a.rel = 'noopener noreferrer';
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            a.remove();
        }
    }, []);

    const handleDeleteSelection = useCallback(() => {
        const state = useWhiteboardStore.getState();
        const ids = resolveDragNodeIds(state.selectedNodeIds, state.nodes);
        if (!ids.length) return;
        const selectedNodes = state.nodes.filter((n) => ids.includes(n.id));
        pushHistory({
            type: 'node_delete',
            payload: { nodes: selectedNodes.map((n) => JSON.parse(JSON.stringify(n))) },
        });
        if (!collabConnected) {
            for (const id of ids) {
                deleteNodeService(id);
            }
        }
        collabDeleteNodes(ids);
        setSelection([]);
    }, [pushHistory, collabConnected, collabDeleteNodes, setSelection]);

    const handleSelectionColor = useCallback(
        (color) => {
            const state = useWhiteboardStore.getState();
            const ids = resolveDragNodeIds(state.selectedNodeIds, state.nodes);
            const selected = state.nodes.filter((n) => ids.includes(n.id));
            if (!selected.length) return;
            recordNodesMutation(useWhiteboardStore, ids, () => {
                selected.forEach((n) => {
                    const style = { ...n.style, backgroundColor: color, fill: color };
                    if (n.type === 'sticky_note') {
                        style.color = contrastingTextColor(color);
                    }
                    collabPatchNode(n.id, { style });
                });
            });
        },
        [collabPatchNode]
    );

    const handleNodeContextMenu = useCallback(
        (e, nodeId) => {
            e.preventDefault();
            e.stopPropagation();
            const st = useWhiteboardStore.getState();
            if (!st.selectedNodeIds.includes(nodeId)) {
                setSelection([nodeId]);
            }
            openSelectionContextMenu(e.clientX, e.clientY);
        },
        [openSelectionContextMenu, setSelection]
    );

    const handleNodePointerDown = useCallback(
        (e, nodeId) => {
            if (e.button !== 0) return;
            if (e.target?.closest?.('.whiteboard-resize-handle, .whiteboard-rotate-handle')) return;
            if (resizeActiveRef.current) return;
            const editingId = useWhiteboardStore.getState().editingNodeId;
            if (editingId && editingId !== nodeId) {
                commitTextEdit();
            } else if (editingId === nodeId && !e.target.closest('textarea, input')) {
                commitTextEdit();
            }
            if (activeTool === 'connector') {
                e.stopPropagation();
                if (connectorFromNodeId) {
                    if (connectorFromNodeId === nodeId) {
                        setConnectorFromNodeId(null);
                        return;
                    }
                    const connId = uuidv4();
                    const conn = {
                        id: connId,
                        fromNodeId: connectorFromNodeId,
                        toNodeId: nodeId,
                        controlPoints: [],
                        style: {},
                    };
                    if (collabConnected) {
                        collabCreateConnector(conn);
                    } else {
                        (async () => {
                            const res = await insertConnector(spaceId, conn);
                            if (res.success) addConnector(conn);
                        })();
                    }
                    setConnectorFromNodeId(null);
                } else {
                    setConnectorFromNodeId(nodeId);
                }
                return;
            }
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const world = screenToWorldWithContainer(e.clientX, e.clientY, rect, viewportForChildren);
            const state = useWhiteboardStore.getState();
            const dragIds = state.selectedNodeIds.includes(nodeId) ? state.selectedNodeIds : [nodeId];
            const prunedDragIds = resolveDragNodeIds(dragIds, state.nodes);
            nodeDragRef.current = {
                nodeId,
                pointerStartWorld: world,
                dragIds: prunedDragIds,
                beforeSnapshots: captureNodesSnapshot(useWhiteboardStore, prunedDragIds),
            };
        },
        [viewportForChildren, activeTool, connectorFromNodeId, setConnectorFromNodeId, spaceId, addConnector, collabConnected, collabCreateConnector, commitTextEdit]
    );

    useEffect(() => {
        const onMove = (e) => {
            if (resizeActiveRef.current) return;
            const ref = nodeDragRef.current;
            if (!ref || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const vp = viewportRef.current;
            const curWorld = screenToWorldWithContainer(e.clientX, e.clientY, rect, vp);
            const totalDx = curWorld.x - ref.pointerStartWorld.x;
            const totalDy = curWorld.y - ref.pointerStartWorld.y;
            const state = useWhiteboardStore.getState();
            const ids = ref.dragIds ?? [ref.nodeId];
            const snap = computeSnapForDrag({
                nodes: state.nodes,
                movingIds: ids,
                initialSnapshots: ref.beforeSnapshots,
                totalDx,
                totalDy,
                zoom: vp?.zoom ?? 1,
                pageId: state.activePageId,
                enabled: state.snapEnabled,
            });
            setSnapGuides(snap.guides);
            const patches = ids.map((id) => {
                const initial = ref.beforeSnapshots?.find((b) => b.id === id)?.node;
                if (!initial) return null;
                return {
                    id,
                    patch: {
                        x: (initial.x ?? 0) + snap.dx,
                        y: (initial.y ?? 0) + snap.dy,
                    },
                };
            }).filter(Boolean);
            if (patches.length) collabPatchNodes(patches);
        };
        const onUp = () => {
            setSnapGuides([]);
            const ref = nodeDragRef.current;
            if (ref) {
                const state = useWhiteboardStore.getState();
                const ids = ref.dragIds ?? [ref.nodeId];
                ids.forEach((id) => {
                    const node = state.nodes.find((n) => n.id === id);
                    if (!node?.parentId) return;
                    const parent = state.nodes.find((n) => n.id === node.parentId);
                    if (!parent) return;
                    const px = node.x ?? 0;
                    const py = node.y ?? 0;
                    const pw = parent.width ?? 0;
                    const ph = parent.height ?? 0;
                    const w = node.width ?? 0;
                    const h = node.height ?? 0;
                    const inside = px >= 0 && py >= 0 && px + w <= pw && py + h <= ph;
                    if (!inside) {
                        collabPatchNode(id, {
                            parentId: null,
                            x: parent.x + px,
                            y: parent.y + py,
                        });
                    }
                });
                const after = captureNodesSnapshot(useWhiteboardStore, ids);
                const before = ref.beforeSnapshots ?? [];
                const changed =
                    before.length > 0 &&
                    before.some((b, i) => {
                        const a = after[i];
                        if (!a) return true;
                        return JSON.stringify(b.node) !== JSON.stringify(a.node);
                    });
                if (changed) {
                    state.pushHistory({
                        type: 'nodes_replace',
                        payload: { before, after },
                    });
                }
            }
            nodeDragRef.current = null;
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
    }, [collabPatchNode, collabPatchNodes]);

    const finalizeCreateDrag = useCallback(
        async (drag, e, rect) => {
            if (!drag?.anchorWorld || drag.finalized || !rect || !viewportForChildren) return;
            const dragStart = drag.startScreen;
            const insideViewport =
                dragStart.x >= rect.left &&
                dragStart.x <= rect.right &&
                dragStart.y >= rect.top &&
                dragStart.y <= rect.bottom;
            if (!insideViewport) {
                drag.finalized = true;
                createDragRef.current = null;
                setCreatePreview(null);
                return;
            }

            const currentWorld = screenToWorldWithContainer(
                e.clientX,
                e.clientY,
                rect,
                viewportForChildren
            );
            const dist = Math.hypot(
                e.clientX - drag.startScreen.x,
                e.clientY - drag.startScreen.y
            );
            const nodeType = creationToolToNodeType(drag.tool);

            if (dist < CREATE_DRAG_THRESHOLD_PX) {
                const defaults = getDefaultNodePayload(
                    nodeType === 'drawing' ? 'draw' : nodeType === 'file_card' ? 'file' : nodeType,
                    drag.anchorWorld.x,
                    drag.anchorWorld.y
                );
                defaults.type = nodeType;
                const id = await createNodeAt(
                    nodeType,
                    drag.anchorWorld.x,
                    drag.anchorWorld.y,
                    {},
                    { width: defaults.width, height: defaults.height }
                );
                if (id) {
                    applyPostCreateActions({
                        nodeId: id,
                        nodeType,
                        keepCreationTool: keepCreationToolRef.current,
                    });
                }
            } else {
                await applyCreateDragBox(drag, currentWorld);
                if (drag.nodeId) {
                    applyPostCreateActions({
                        nodeId: drag.nodeId,
                        nodeType,
                        keepCreationTool: keepCreationToolRef.current,
                    });
                }
            }

            drag.finalized = true;
            createDragRef.current = null;
            setCreatePreview(null);
        },
        [viewportForChildren, createNodeAt, applyCreateDragBox]
    );

    const handlePointerUp = useCallback(
        async (e) => {
            if (e.currentTarget && typeof e.currentTarget.releasePointerCapture === 'function') {
                try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
            }
            if (e.button === 0) {
                keepCreationToolRef.current = e.ctrlKey || e.metaKey;
                const rect = containerRef.current?.getBoundingClientRect();
                const controlsEl = containerRef.current?.querySelector('.whiteboard-viewport-controls');
                const controlsRect = controlsEl?.getBoundingClientRect?.();
                const drag = createDragRef.current;
                const dragStart = drag?.startScreen;
                const isClickInControls =
                    controlsRect &&
                    dragStart &&
                    dragStart.x >= controlsRect.left &&
                    dragStart.x <= controlsRect.right &&
                    dragStart.y >= controlsRect.top &&
                    dragStart.y <= controlsRect.bottom;
                if (isClickInControls) {
                    createDragRef.current = null;
                    setCreatePreview(null);
                } else if (drag?.anchorWorld && rect && viewportForChildren && !isClickInControls) {
                    const stillDragging =
                        e.type === 'pointerleave' && (e.buttons & 1);
                    if (!stillDragging) {
                        await finalizeCreateDrag(drag, e, rect);
                    }
                } else if (drag?.clickOnly && !drag?.finalized && rect && viewportForChildren && !isClickInControls) {
                    const stillDraggingClick =
                        e.type === 'pointerleave' && (e.buttons & 1);
                    if (!stillDraggingClick) {
                        const { x: sx, y: sy } = drag.startScreen;
                        const insideViewport =
                            sx >= rect.left && sx <= rect.right && sy >= rect.top && sy <= rect.bottom;
                        const clickDist = Math.hypot(e.clientX - sx, e.clientY - sy);
                        if (insideViewport && clickDist < CREATE_DRAG_THRESHOLD_PX) {
                            const w1 = screenToWorldWithContainer(sx, sy, rect, viewportForChildren);
                            const nodeType = creationToolToNodeType(drag.tool);
                            const defaultKey =
                                nodeType === 'drawing' ? 'draw' : nodeType === 'file_card' ? 'file' : nodeType;
                            const defaults = getDefaultNodePayload(defaultKey, w1.x, w1.y);
                            defaults.type = nodeType;
                            const [ox, oy] = getNodeCreateOffset(drag.tool || nodeType);
                            const id = await createNodeAt(nodeType, w1.x - ox, w1.y - oy);
                            if (id) {
                                applyPostCreateActions({
                                    nodeId: id,
                                    nodeType,
                                    keepCreationTool: keepCreationToolRef.current,
                                });
                            }
                        }
                        drag.finalized = true;
                        createDragRef.current = null;
                    }
                } else if (selectionBox) {
                    const w = Math.abs(selectionBox.current.x - selectionBox.start.x);
                    const h = Math.abs(selectionBox.current.y - selectionBox.start.y);
                    const isClick = w < 8 && h < 8;
                    if (rect && viewportForChildren) {
                        const w1 = screenToWorldWithContainer(
                            selectionBox.start.x,
                            selectionBox.start.y,
                            rect,
                            viewportForChildren
                        );
                        if (isClick && activeTool === 'select') {
                            setSelection([]);
                        } else if (!isClick) {
                            const w2 = screenToWorldWithContainer(
                                selectionBox.current.x,
                                selectionBox.current.y,
                                rect,
                                viewportForChildren
                            );
                            const box = {
                                x: Math.min(w1.x, w2.x),
                                y: Math.min(w1.y, w2.y),
                                width: Math.abs(w2.x - w1.x),
                                height: Math.abs(w2.y - w1.y),
                            };
                            const hitIds = nodes
                                .filter((n) =>
                                    rectIntersects(box, {
                                        x: n.x,
                                        y: n.y,
                                        width: n.width || 0,
                                        height: n.height || 0,
                                    })
                                )
                                .map((n) => n.id);
                            setSelection(resolveDragNodeIds(hitIds, nodes));
                        }
                    }
                    setSelectionBox(null);
                }
            }
            viewportState.handleMouseUp();
        },
        [selectionBox, viewportForChildren, nodes, setSelection, activeTool, createNodeAt, finalizeCreateDrag]
    );

    const handlePointerMove = useCallback(
        (e) => {
            lastPointerClientRef.current = { x: e.clientX, y: e.clientY };
            if (createDragRef.current) {
                keepCreationToolRef.current = e.ctrlKey || e.metaKey;
            }
            const drag = createDragRef.current;
            if (selectionBox) {
                setSelectionBox((prev) => (prev ? { ...prev, current: { x: e.clientX, y: e.clientY } } : null));
            } else if (drag?.anchorWorld) {
                const rect = containerRef.current?.getBoundingClientRect();
                if (rect && viewportRef.current) {
                    const currentWorld = screenToWorldWithContainer(
                        e.clientX,
                        e.clientY,
                        rect,
                        viewportRef.current
                    );
                    setCreatePreview({ anchorWorld: drag.anchorWorld, currentWorld });
                    const dist = Math.hypot(
                        e.clientX - drag.startScreen.x,
                        e.clientY - drag.startScreen.y
                    );
                    if (dist >= CREATE_DRAG_THRESHOLD_PX) {
                        void applyCreateDragBox(drag, currentWorld);
                    }
                }
            } else {
                viewportState.handleMouseMove(e);
            }
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect && viewportRef.current && isCanvasBackground(e)) {
                const world = screenToWorldWithContainer(e.clientX, e.clientY, rect, viewportRef.current);
                updateCursor({ x: world.x, y: world.y });
            }
        },
        [selectionBox, viewportState, updateCursor, applyCreateDragBox]
    );

    const handleContextMenu = useCallback(
        (e) => {
            const el = e.target;
            if (el?.closest?.('.whiteboard-node-wrapper') || el?.closest?.('.whiteboard-viewport-controls')) return;
            e.preventDefault();
            const st = useWhiteboardStore.getState();
            if (st.selectedNodeIds.length > 0 && activeTool === 'select') {
                openSelectionContextMenu(e.clientX, e.clientY);
                return;
            }
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect || !viewportForChildren) return;
            const world = screenToWorldWithContainer(e.clientX, e.clientY, rect, viewportForChildren);
            setContextMenuPosition({
                left: e.clientX,
                top: e.clientY,
                worldX: world.x,
                worldY: world.y,
                mode: 'create',
            });
        },
        [viewportForChildren, activeTool, openSelectionContextMenu]
    );

    const handleContextMenuCreate = useCallback(
        async (type, worldX, worldY) => {
            const id = await createNodeAt(type, worldX, worldY);
            if (id) {
                applyPostCreateActions({
                    nodeId: id,
                    nodeType: type,
                    keepCreationTool: false,
                });
            }
            setContextMenuPosition(null);
        },
        [createNodeAt]
    );

    const handleContextMenuUploadImage = useCallback(() => {
        if (contextMenuPosition) {
            pendingUploadWorldPositionRef.current = {
                x: contextMenuPosition.worldX - 100,
                y: contextMenuPosition.worldY - 75,
            };
            setContextMenuPosition(null);
        }
        openImagePickerRef.current?.();
    }, [contextMenuPosition]);

    const handleContextMenuUploadFile = useCallback(() => {
        if (contextMenuPosition) {
            pendingUploadWorldPositionRef.current = {
                x: contextMenuPosition.worldX - 110,
                y: contextMenuPosition.worldY - 40,
            };
            setContextMenuPosition(null);
        }
        openFilePickerRef.current?.();
    }, [contextMenuPosition]);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }, []);

    const handleDrop = useCallback(
        async (e) => {
            e.preventDefault();
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect || !viewportForChildren) return;
            const world = screenToWorldWithContainer(e.clientX, e.clientY, rect, viewportForChildren);
            const toolType = e.dataTransfer.getData('application/x-whiteboard-tool');
            if (toolType && NODE_TYPES_ALLOWED.includes(toolType)) {
                const [ox, oy] = getNodeCreateOffset(toolType);
                const id = await createNodeAt(toolType, world.x - ox, world.y - oy);
                if (id) {
                    applyPostCreateActions({
                        nodeId: id,
                        nodeType: toolType,
                        keepCreationTool: e.ctrlKey || e.metaKey,
                    });
                }
                return;
            }
            const files = e.dataTransfer.files;
            if (!files?.length) return;
            const nodes = useWhiteboardStore.getState().nodes;
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                let wx = world.x - 100 + i * 20;
                let wy = world.y - 75 + i * 20;
                let type = 'image';
                if (!file.type.startsWith('image/')) {
                    wx = world.x - 110 + i * 20;
                    wy = world.y - 40 + i * 20;
                    type = 'file_card';
                }
                const centerX = wx + (type === 'image' ? 100 : 110);
                const centerY = wy + (type === 'image' ? 75 : 40);
                const container = findContainerAt(nodes, centerX, centerY);
                if (file.type.startsWith('image/')) {
                    const result = await uploadSpaceAsset(spaceId, file, user?.id);
                    if (result?.url) {
                        const sizeStr = file.size != null ? (file.size < 1024 ? `${file.size} B` : file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`) : '';
                        const payload = getDefaultNodePayload('image', wx, wy);
                        Object.assign(payload.data, { url: result.url, filename: file.name, size: sizeStr });
                        if (container) {
                            payload.parentId = container.id;
                            payload.x = wx - container.x;
                            payload.y = wy - container.y;
                        }
                        if (collabConnected) {
                            collabCreateNode({ ...payload, createdBy: user?.id ?? null });
                        } else {
                            const res = await insertNode(spaceId, payload, user?.id);
                            if (res.success) addNode(payload);
                        }
                    }
                } else {
                    const result = await uploadSpaceAsset(spaceId, file, user?.id);
                    if (result?.url) {
                        const sizeStr = file.size != null ? (file.size < 1024 ? `${file.size} B` : file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`) : '';
                        const payload = getDefaultNodePayload('file_card', wx, wy);
                        Object.assign(payload.data, { url: result.url, filename: file.name, size: sizeStr });
                        if (container) {
                            payload.parentId = container.id;
                            payload.x = wx - container.x;
                            payload.y = wy - container.y;
                        }
                        if (collabConnected) {
                            collabCreateNode({ ...payload, createdBy: user?.id ?? null });
                        } else {
                            const res = await insertNode(spaceId, payload, user?.id);
                            if (res.success) addNode(payload);
                        }
                    }
                }
            }
        },
        [viewportForChildren, spaceId, user?.id, createNodeAt, addNode, collabCreateNode, collabConnected]
    );

    return (
        <>
            <div
                className="whiteboard-editor-layout"
                style={{ '--inspector-inset': `${getInspectorInsetPx(inspectorPanelOpen)}px` }}
            >
                <div className="whiteboard-canvas-column">
                <div
                    className={`whiteboard-viewport ${viewportState.isPanning ? 'panning' : ''} ${isSpacePressed ? 'space-pressed' : ''} ${!gridVisible ? 'grid-hidden' : ''} ${rulersVisible ? 'rulers-visible' : ''}`}
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
                style={{
                    backgroundSize: `${24 * viewportState.zoom}px ${24 * viewportState.zoom}px`,
                    backgroundPosition: `${viewportState.pan.x % (24 * viewportState.zoom)}px ${viewportState.pan.y % (24 * viewportState.zoom)}px`,
                }}
            >
                <div
                    className="whiteboard-canvas-transform"
                    style={viewportState.transformStyle}
                >
                    <ConnectorLayer />
                    <SnapGuidesOverlay guides={snapGuides} />
                    <div className="whiteboard-nodes-container">
                        <NodeLayer
                            onNodePointerDown={handleNodePointerDown}
                            onNodeContextMenu={handleNodeContextMenu}
                            onResizeStart={handleResizeStart}
                            onRotateStart={handleRotateStart}
                        />
                    </div>
                    <SelectionTransformOverlay
                        viewport={viewportForChildren}
                        onResizeStart={handleResizeStart}
                        onRotateStart={handleRotateStart}
                    />
                </div>
                <SelectionManager
                    selectionBox={selectionBox}
                    createPreview={createPreview}
                    viewport={viewportForChildren}
                    containerRef={containerRef}
                />
                <PresenceLayer viewport={viewportForChildren} />
                {rulersVisible && (
                    <RulersOverlay viewport={viewportForChildren} containerRef={containerRef} />
                )}
                <div
                    className="whiteboard-viewport-controls"
                    onPointerDown={(e) => {
                        e.stopPropagation();
                    }}
                >
                    <button
                        type="button"
                        title="Centralizar vista"
                        onClick={() => viewportState.setViewport({ x: 0, y: 0 }, 1)}
                    >
                        <Focus size={18} />
                    </button>
                    <span className="whiteboard-viewport-controls-divider" aria-hidden />
                    <button
                        type="button"
                        title={gridVisible ? 'Ocultar grade' : 'Mostrar grade'}
                        className={gridVisible ? 'active' : ''}
                        onClick={() => setGridVisible(!gridVisible)}
                    >
                        <Grid3X3 size={18} />
                    </button>
                    <button
                        type="button"
                        title={rulersVisible ? 'Ocultar réguas (Ctrl+R)' : 'Mostrar réguas (Ctrl+R)'}
                        className={rulersVisible ? 'active' : ''}
                        onClick={() => setRulersVisible(!rulersVisible)}
                    >
                        <Ruler size={18} />
                    </button>
                    <button
                        type="button"
                        title={snapEnabled ? 'Desativar imã (alinhamento)' : 'Ativar imã (alinhamento)'}
                        className={snapEnabled ? 'active' : ''}
                        onClick={() => {
                            const next = !snapEnabled;
                            setSnapEnabled(next);
                            if (!next) setSnapGuides([]);
                        }}
                    >
                        <Magnet size={18} />
                    </button>
                    <button
                        type="button"
                        title="Diminuir zoom"
                        onClick={() => {
                            const { x, y } = getZoomFocalClient();
                            viewportState.zoomAtClient(x, y, 1 / 1.2);
                        }}
                    >
                        <ZoomOut size={18} />
                    </button>
                    <span className="zoom-label">{Math.round(viewportState.zoom * 100)}%</span>
                    <button
                        type="button"
                        title="Aumentar zoom"
                        onClick={() => {
                            const { x, y } = getZoomFocalClient();
                            viewportState.zoomAtClient(x, y, 1.2);
                        }}
                    >
                        <ZoomIn size={18} />
                    </button>
                    <button
                        type="button"
                        title="Atalhos (?)"
                        onClick={() => setShortcutsHelpOpen(true)}
                    >
                        <HelpCircle size={18} />
                    </button>
                </div>
            </div>
                </div>
                <InspectorPanel
                    spaceId={spaceId}
                    spaceTitle={space?.name || space?.title || 'Space'}
                    open={inspectorPanelOpen}
                    onToggle={() => setInspectorPanelOpen(!inspectorPanelOpen)}
                />
            </div>
            <ShortcutsHelp open={shortcutsHelpOpen} onClose={() => setShortcutsHelpOpen(false)} />
            <DraggablePanel id="whiteboard-toolbar" defaultBottom={16} hideHandle style={isMobile ? { left: 12, right: 12, transform: 'none' } : undefined}>
                <LeftToolbar
                    onUploadImage={handleUploadImage}
                    onUploadFile={handleUploadFile}
                    registerOpenImagePicker={(fn) => { openImagePickerRef.current = fn; }}
                    registerOpenFilePicker={(fn) => { openFilePickerRef.current = fn; }}
                    variant="bottom"
                />
            </DraggablePanel>
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
                showColorPicker={contextMenuPosition?.showColorPicker}
                showDownloadImage={contextMenuPosition?.showDownloadImage}
            />
        </>
    );
}
