import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useViewport } from './ViewportController';
import { useWhiteboardStore } from '../../stores/whiteboardStore';
import { getDefaultNodePayload, isCreationTool } from '../../stores/whiteboardStore';
import { insertNode, insertConnector, uploadSpaceAsset } from '../../services/whiteboardService';
import { fetchNodes, fetchConnectors, fetchComments } from '../../services/whiteboardService';
import { screenToWorldWithContainer, rectIntersects, findContainerAt } from './viewportUtils';
import NodeLayer from './NodeLayer';
import ConnectorLayer from './ConnectorLayer';
import SelectionManager from './SelectionManager';
import ResizeHandles from './ResizeHandles';
import FloatingToolbar from './FloatingToolbar';
import RealtimeSync from './RealtimeSync';
import Autosave from './Autosave';
import LeftToolbar from './LeftToolbar';
import DraggablePanel from './DraggablePanel';
import WhiteboardContextMenu from './WhiteboardContextMenu';
import { Grid3X3, ZoomIn, ZoomOut } from 'lucide-react';
import { uuidv4 } from '../../utils/uuid';
import './CanvasEngine.css';

export default function CanvasEngine({ spaceId, space, onViewportChange }) {
    const containerRef = useRef(null);
    const [selectionBox, setSelectionBox] = useState(null);
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    const [resizeState, setResizeState] = useState(null);
    const [contextMenuPosition, setContextMenuPosition] = useState(null);
    const pendingUploadWorldPositionRef = useRef(null);
    const openImagePickerRef = useRef(null);
    const openFilePickerRef = useRef(null);
    const nodeDragRef = useRef(null);
    const pendingCreateRef = useRef(null);
    const viewportRef = useRef(null);
    const initialPan = { x: space?.panX ?? 0, y: space?.panY ?? 0 };
    const initialZoom = space?.zoom ?? 1;
    const isMobile = typeof window !== 'undefined' ? window.innerWidth <= 768 : false;

    useEffect(() => {
        const onKeyDown = (e) => { if (e.key === ' ') setIsSpacePressed(true); };
        const onKeyUp = (e) => { if (e.key === ' ') setIsSpacePressed(false); };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, []);

    const { user } = useAuth();
    const {
        setSpaceId,
        setNodes,
        setConnectors,
        setComments,
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
        setSuppressRealtimeUntil,
        gridVisible,
        setGridVisible,
        setLastCreatedNodeId,
        lastCreatedNodeId,
    } = useWhiteboardStore();

    useEffect(() => {
        if (!lastCreatedNodeId) return;
        const t = setTimeout(() => setLastCreatedNodeId(null), 350);
        return () => clearTimeout(t);
    }, [lastCreatedNodeId, setLastCreatedNodeId]);

    const NODE_TYPES_ALLOWED = ['sticky_note', 'text', 'shape', 'frame', 'image', 'comment', 'link', 'todo_list', 'file_card', 'drawing', 'column', 'table'];

    const createNodeAt = useCallback(
        async (type, worldX, worldY, extraData = {}) => {
            if (!spaceId || !NODE_TYPES_ALLOWED.includes(type)) return;
            const payload = getDefaultNodePayload(type, worldX, worldY);
            Object.assign(payload.data, extraData.data || {});
            if (extraData.style) Object.assign(payload.style, extraData.style);
            const nodes = useWhiteboardStore.getState().nodes;
            const centerX = worldX + (payload.width ?? 0) / 2;
            const centerY = worldY + (payload.height ?? 0) / 2;
            const container = findContainerAt(nodes, centerX, centerY);
            if (container) {
                payload.parentId = container.id;
                payload.x = worldX - container.x;
                payload.y = worldY - container.y;
            }
            const res = await insertNode(spaceId, payload, user?.id);
            if (res.success) {
                addNode(payload);
                setLastCreatedNodeId(payload.id);
            }
        },
        [spaceId, user?.id, addNode, setLastCreatedNodeId]
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
            setSuppressRealtimeUntil(2000);
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
                const res = await insertNode(spaceId, payload, user?.id);
                if (res.success) addNode(payload);
            } catch (err) {
                console.error('[CanvasEngine] handleUploadImage error', err);
            }
        },
        [spaceId, user?.id, addNode, getViewportCenterWorld, setSuppressRealtimeUntil]
    );

    const handleUploadFile = useCallback(
        async (file) => {
            if (!spaceId || !file) return;
            setSuppressRealtimeUntil(2000);
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
                const res = await insertNode(spaceId, payload, user?.id);
                if (res.success) addNode(payload);
            } catch (err) {
                console.error('[CanvasEngine] handleUploadFile error', err);
            }
        },
        [spaceId, user?.id, addNode, getViewportCenterWorld, setSuppressRealtimeUntil]
    );

    const persistViewport = useCallback(
        (pan, zoom) => {
            setStoreViewport({ panX: pan.x, panY: pan.y, zoom });
            if (onViewportChange) onViewportChange(pan, zoom);
        },
        [setStoreViewport, onViewportChange]
    );

    const viewportState = useViewport(initialPan, initialZoom, persistViewport);
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
        setStoreViewport({ panX: initialPan.x, panY: initialPan.y, zoom: initialZoom });
    }, [spaceId]);

    useEffect(() => {
        if (!spaceId) return;
        let cancelled = false;
        (async () => {
            const [nodesRes, connRes, commentsRes] = await Promise.all([
                fetchNodes(spaceId),
                fetchConnectors(spaceId),
                fetchComments(spaceId),
            ]);
            if (cancelled) return;
            if (nodesRes.data) setNodes(nodesRes.data);
            if (connRes.data) setConnectors(connRes.data);
            if (commentsRes.data) setComments(commentsRes.data);
        })();
        return () => { cancelled = true; };
    }, [spaceId, setNodes, setConnectors, setComments]);

    const isCanvasBackground = (e) =>
        !e.target?.closest?.('.whiteboard-node-wrapper') && !e.target?.closest?.('.whiteboard-viewport-controls');

    const handlePointerDown = useCallback(
        (e) => {
            if (e.button !== 0 && e.button !== 1) return;
            const isBg = isCanvasBackground(e);
            if (e.button === 1 || (e.button === 0 && isBg && isSpacePressed)) {
                e.preventDefault();
                viewportState.handleMouseDown(e, isBg, isSpacePressed);
                return;
            }
            if (e.button === 0 && isBg && !isSpacePressed) {
                e.preventDefault();
                if (activeTool === 'select') {
                    setSelectionBox({
                        start: { x: e.clientX, y: e.clientY },
                        current: { x: e.clientX, y: e.clientY },
                    });
                    if (e.currentTarget && typeof e.currentTarget.setPointerCapture === 'function') {
                        e.currentTarget.setPointerCapture(e.pointerId);
                    }
                } else if (isCreationTool(activeTool) && activeTool !== 'connector' && NODE_TYPES_ALLOWED.includes(activeTool)) {
                    pendingCreateRef.current = { x: e.clientX, y: e.clientY };
                    if (e.currentTarget && typeof e.currentTarget.setPointerCapture === 'function') {
                        e.currentTarget.setPointerCapture(e.pointerId);
                    }
                }
            }
        },
        [viewportState, isSpacePressed, activeTool]
    );

    const handleResizeStart = useCallback((nodeId, corner, e) => {
        e.stopPropagation();
        if (e.currentTarget?.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
        setResizeState({ nodeId, corner });
    }, []);

    useEffect(() => {
        if (!resizeState) return;
        const { nodeId, corner } = resizeState;
        const MIN = 24;
        const onMove = (e) => {
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect || !viewportRef.current) return;
            const world = screenToWorldWithContainer(e.clientX, e.clientY, rect, viewportRef.current);
            const state = useWhiteboardStore.getState();
            const node = state.nodes.find((n) => n.id === nodeId);
            if (!node) return;
            const w0 = node.width || MIN;
            const h0 = node.height || MIN;
            const right = node.x + w0;
            const bottom = node.y + h0;
            let x = node.x, y = node.y, w = w0, h = h0;
            switch (corner) {
                case 'se':
                    w = Math.max(MIN, world.x - node.x);
                    h = Math.max(MIN, world.y - node.y);
                    break;
                case 'sw':
                    x = world.x;
                    y = node.y;
                    w = Math.max(MIN, right - world.x);
                    h = Math.max(MIN, world.y - node.y);
                    break;
                case 'ne':
                    x = node.x;
                    y = world.y;
                    w = Math.max(MIN, world.x - node.x);
                    h = Math.max(MIN, bottom - world.y);
                    break;
                case 'nw':
                    x = world.x;
                    y = world.y;
                    w = Math.max(MIN, right - world.x);
                    h = Math.max(MIN, bottom - world.y);
                    break;
                default:
                    break;
            }
            state.patchNode(nodeId, { x, y, width: w, height: h });
        };
        const onUp = () => setResizeState(null);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
    }, [resizeState]);

    const handleNodePointerDown = useCallback(
        (e, nodeId) => {
            if (e.button !== 0) return;
            if (activeTool === 'connector') {
                e.stopPropagation();
                if (connectorFromNodeId) {
                    if (connectorFromNodeId === nodeId) {
                        setConnectorFromNodeId(null);
                        return;
                    }
                    const connId = uuidv4();
                    (async () => {
                        const res = await insertConnector(spaceId, {
                            id: connId,
                            fromNodeId: connectorFromNodeId,
                            toNodeId: nodeId,
                            controlPoints: [],
                            style: {},
                        });
                        if (res.success) addConnector({ id: connId, fromNodeId: connectorFromNodeId, toNodeId: nodeId, controlPoints: [], style: {} });
                    })();
                    setConnectorFromNodeId(null);
                } else {
                    setConnectorFromNodeId(nodeId);
                }
                return;
            }
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const world = screenToWorldWithContainer(e.clientX, e.clientY, rect, viewportForChildren);
            nodeDragRef.current = {
                nodeId,
                startWorld: world,
                startScreen: { x: e.clientX, y: e.clientY },
            };
        },
        [viewportForChildren, activeTool, connectorFromNodeId, setConnectorFromNodeId, spaceId, addConnector]
    );

    useEffect(() => {
        const onMove = (e) => {
            const ref = nodeDragRef.current;
            if (!ref || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const vp = viewportRef.current;
            const curWorld = screenToWorldWithContainer(e.clientX, e.clientY, rect, vp);
            const dx = curWorld.x - ref.startWorld.x;
            const dy = curWorld.y - ref.startWorld.y;
            ref.startWorld = curWorld;
            const { patchNodes } = useWhiteboardStore.getState();
            const state = useWhiteboardStore.getState();
            const ids = state.selectedNodeIds.includes(ref.nodeId) ? state.selectedNodeIds : [ref.nodeId];
            const patches = ids.map((id) => {
                const n = state.nodes.find((node) => node.id === id);
                return n ? { id, patch: { x: n.x + dx, y: n.y + dy } } : null;
            }).filter(Boolean);
            if (patches.length) patchNodes(patches);
        };
        const onUp = () => {
            const ref = nodeDragRef.current;
            if (ref) {
                const state = useWhiteboardStore.getState();
                const ids = state.selectedNodeIds.includes(ref.nodeId) ? state.selectedNodeIds : [ref.nodeId];
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
                        useWhiteboardStore.getState().patchNode(id, {
                            parentId: null,
                            x: parent.x + px,
                            y: parent.y + py,
                        });
                    }
                });
            }
            nodeDragRef.current = null;
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
    }, []);

    const handleDoubleClick = useCallback(
        async (e) => {
            if (!isCanvasBackground(e) || !spaceId) return;
            e.preventDefault();
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const world = screenToWorldWithContainer(e.clientX, e.clientY, rect, viewportForChildren);
            await createNodeAt('sticky_note', world.x - 75, world.y - 50);
        },
        [spaceId, viewportForChildren, createNodeAt]
    );

    const handlePointerUp = useCallback(
        (e) => {
            if (e.currentTarget && typeof e.currentTarget.releasePointerCapture === 'function') {
                try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
            }
            if (e.button === 0) {
                const rect = containerRef.current?.getBoundingClientRect();
                const controlsEl = containerRef.current?.querySelector('.whiteboard-viewport-controls');
                const controlsRect = controlsEl?.getBoundingClientRect?.();
                const isClickInControls =
                    controlsRect &&
                    pendingCreateRef.current &&
                    pendingCreateRef.current.x >= controlsRect.left &&
                    pendingCreateRef.current.x <= controlsRect.right &&
                    pendingCreateRef.current.y >= controlsRect.top &&
                    pendingCreateRef.current.y <= controlsRect.bottom;
                if (isClickInControls) pendingCreateRef.current = null;
                if (pendingCreateRef.current && rect && viewportForChildren && !isClickInControls) {
                    const { x: sx, y: sy } = pendingCreateRef.current;
                    const insideViewport =
                        sx >= rect.left && sx <= rect.right && sy >= rect.top && sy <= rect.bottom;
                    if (insideViewport) {
                        const w1 = screenToWorldWithContainer(sx, sy, rect, viewportForChildren);
                        const offsets = { sticky_note: [75, 50], text: [100, 20], shape: [50, 50], frame: [150, 100], image: [100, 75], comment: [100, 40], link: [120, 40], todo_list: [110, 60], file_card: [110, 40], drawing: [100, 75], column: [100, 100], table: [140, 60] };
                        const [ox, oy] = offsets[activeTool] || [50, 50];
                        const finalX = w1.x - ox;
                        const finalY = w1.y - oy;
                        createNodeAt(activeTool, finalX, finalY);
                    }
                    pendingCreateRef.current = null;
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
                            const ids = nodes
                                .filter(
                                    (n) =>
                                        rectIntersects(
                                            box,
                                            { x: n.x, y: n.y, width: n.width || 0, height: n.height || 0 }
                                        )
                                )
                                .map((n) => n.id);
                            setSelection(ids);
                        }
                    }
                    setSelectionBox(null);
                }
            }
            viewportState.handleMouseUp();
        },
        [selectionBox, viewportForChildren, nodes, setSelection, activeTool, createNodeAt]
    );

    const handlePointerMove = useCallback(
        (e) => {
            if (selectionBox) {
                setSelectionBox((prev) => (prev ? { ...prev, current: { x: e.clientX, y: e.clientY } } : null));
            } else {
                viewportState.handleMouseMove(e);
            }
        },
        [selectionBox, viewportState]
    );

    const handleContextMenu = useCallback(
        (e) => {
            const el = e.target;
            if (el?.closest?.('.whiteboard-node-wrapper') || el?.closest?.('.whiteboard-viewport-controls')) return;
            e.preventDefault();
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect || !viewportForChildren) return;
            const world = screenToWorldWithContainer(e.clientX, e.clientY, rect, viewportForChildren);
            setContextMenuPosition({ left: e.clientX, top: e.clientY, worldX: world.x, worldY: world.y });
        },
        [viewportForChildren]
    );

    const handleContextMenuCreate = useCallback(
        (type, worldX, worldY) => {
            createNodeAt(type, worldX, worldY);
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
                const offsets = { sticky_note: [75, 50], text: [100, 20], shape: [50, 50], frame: [150, 100], image: [100, 75], comment: [100, 40] };
                const [ox, oy] = offsets[toolType] || [50, 50];
                createNodeAt(toolType, world.x - ox, world.y - oy);
                return;
            }
            const files = e.dataTransfer.files;
            if (!files?.length) return;
            setSuppressRealtimeUntil(2000);
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
                        const res = await insertNode(spaceId, payload, user?.id);
                        if (res.success) addNode(payload);
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
                        const res = await insertNode(spaceId, payload, user?.id);
                        if (res.success) addNode(payload);
                    }
                }
            }
        },
        [viewportForChildren, spaceId, user?.id, createNodeAt, addNode, setSuppressRealtimeUntil]
    );

    return (
        <>
            <RealtimeSync spaceId={spaceId} />
            <Autosave />
            <div className="whiteboard-editor-layout">
                <div
                    className={`whiteboard-viewport ${viewportState.isPanning ? 'panning' : ''} ${isSpacePressed ? 'space-pressed' : ''} ${!gridVisible ? 'grid-hidden' : ''}`}
                    ref={containerRef}
                onWheel={viewportState.handleWheel}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onDoubleClick={handleDoubleClick}
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
                    <div className="whiteboard-nodes-container">
                        <NodeLayer onNodePointerDown={handleNodePointerDown} onResizeStart={handleResizeStart} />
                    </div>
                </div>
                <SelectionManager selectionBox={selectionBox} />
                <div className="whiteboard-viewport-controls" onMouseDown={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        title={gridVisible ? 'Ocultar grade' : 'Mostrar grade'}
                        onClick={() => setGridVisible(!gridVisible)}
                    >
                        <Grid3X3 size={18} />
                    </button>
                    <button
                        type="button"
                        title="Diminuir zoom"
                        onClick={() => viewportState.setViewport(viewportState.pan, Math.max(0.1, viewportState.zoom / 1.2))}
                    >
                        <ZoomOut size={18} />
                    </button>
                    <span className="zoom-label">{Math.round(viewportState.zoom * 100)}%</span>
                    <button
                        type="button"
                        title="Aumentar zoom"
                        onClick={() => viewportState.setViewport(viewportState.pan, Math.min(5, viewportState.zoom * 1.2))}
                    >
                        <ZoomIn size={18} />
                    </button>
                </div>
            </div>
            </div>
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
            />
            {selectedNodeIds.length > 0 && <FloatingToolbar viewport={viewportForChildren} containerRef={containerRef} />}
        </>
    );
}
