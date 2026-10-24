/** Arrastar nós (seleção múltipla, snap, reparent em frames e preview de presença para colegas). */
import { useEffect, useCallback } from 'react';
import { useWhiteboardStore } from '../../../../stores/whiteboardStore';
import { useWhiteboardSelectionStore } from '../../../../stores/whiteboardSelectionStore';
import { isCreationTool } from '../../../../stores/whiteboardStore';
import { insertConnector } from '../../../../services/whiteboardService';
import { creationToolToNodeType } from '../../interaction/hooks/useCreateTool';
import { screenToWorldWithContainer } from '../../interaction/viewport/viewportUtils';
import {
    getZoomAwareCreateDims,
    getZoomAwareMinCreateSize,
} from '../../interaction/viewport/viewportCreation.js';
import { captureNodesSnapshot } from '../../core/history/whiteboardHistory';
import { filterNodesByPage } from '../../core/pages/whiteboardPages';
import { computeSnapForDrag, buildSnapExcludeIds } from '../../interaction/snap/whiteboardSnap';
import { nodeToWorld, buildNodesById } from '../../core/ops/whiteboardNodeOps';
import { resolveDragNodeIds, buildDragFinishPatches } from '../../core/selection/whiteboardSelectionUtils';
import {
    findDropContainerForNode,
    buildNestInContainerPatch,
} from '../../core/layers/layersPanelOps';
import { uuidv4 } from '../../../../utils/uuid';
import { NODE_TYPES_ALLOWED } from '../../shared/constants';

import { dragPreviewBorderFromNode } from './dragPreviewBorder';

export function useNodeDrag(ctx) {
    const {
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
    } = ctx;

    const handleNodePointerDown = useCallback(
        (e, nodeId) => {
            if (e.button !== 0) return;
            if (e.target?.closest?.('.whiteboard-resize-handle, .whiteboard-rotate-handle')) return;
            if (resizeActiveRef.current) return;
            if (isCreationTool(activeTool) && activeTool !== 'connector') {
                e.stopPropagation();
                e.preventDefault();
                const rect = containerRef.current?.getBoundingClientRect();
                if (!rect || !viewportForChildren) return;
                if (isDragCreationTool(activeTool)) {
                    const anchorWorld = screenToWorldWithContainer(
                        e.clientX,
                        e.clientY,
                        rect,
                        viewportForChildren
                    );
                    const nodeType = creationToolToNodeType(activeTool);
                    const defaultKey =
                        nodeType === 'drawing' ? 'draw' : nodeType === 'file_card' ? 'file' : nodeType;
                    const zoom = viewportForChildren.zoom ?? 1;
                    const aware = getZoomAwareCreateDims(defaultKey, zoom);
                    const aspectRatio =
                        aware.width && aware.height ? aware.width / aware.height : 1;
                    const minSize = getZoomAwareMinCreateSize(zoom);
                    createDragRef.current = {
                        tool: activeTool,
                        anchorWorld,
                        startScreen: { x: e.clientX, y: e.clientY },
                        nodeId: null,
                        creating: false,
                        aspectRatio,
                    };
                    setCreatePreview({
                        anchorWorld,
                        currentWorld: anchorWorld,
                        shiftKey: e.shiftKey,
                        altKey: e.altKey,
                        aspectRatio,
                        minSize,
                    });
                } else if (NODE_TYPES_ALLOWED.includes(creationToolToNodeType(activeTool))) {
                    createDragRef.current = {
                        tool: activeTool,
                        clickOnly: true,
                        startScreen: { x: e.clientX, y: e.clientY },
                    };
                }
                const captureEl = e.currentTarget ?? e.target;
                if (captureEl?.setPointerCapture) {
                    try {
                        captureEl.setPointerCapture(e.pointerId);
                    } catch (_) {}
                }
                return;
            }
            const editingId = useWhiteboardStore.getState().editingNodeId;
            if (editingId === nodeId && e.target.closest('textarea, input')) {
                return;
            }
            if (editingId) {
                commitTextEdit();
            }
            containerRef.current?.focus?.({ preventScroll: true });
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
                            if (res.success) useWhiteboardStore.getState().addConnector(conn);
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
            const state = useWhiteboardStore.getState();
            const dragIds = state.selectedNodeIds.includes(nodeId) ? state.selectedNodeIds : [nodeId];
            const prunedDragIds = resolveDragNodeIds(dragIds, state.nodes, {
                groupDrill: state.groupDrill,
                isolateSelection: state.isolateSelection,
            });
            nodeDragRef.current = {
                nodeId,
                pointerStartClient: { x: e.clientX, y: e.clientY },
                dragIds: prunedDragIds,
                beforeSnapshots: captureNodesSnapshot(useWhiteboardStore, prunedDragIds),
                snapExcludeIds: buildSnapExcludeIds(prunedDragIds, state.nodes),
                lastOffset: { dx: 0, dy: 0 },
            };
            useWhiteboardSelectionStore.getState().setNodeDragPreview({
                ids: prunedDragIds,
                dx: 0,
                dy: 0,
            });
            const captureEl = e.currentTarget ?? e.target;
            if (captureEl?.setPointerCapture) {
                try {
                    captureEl.setPointerCapture(e.pointerId);
                } catch (_) {}
            }
        },
        [resizeActiveRef, activeTool, containerRef, nodeDragRef, viewportForChildren, isDragCreationTool, createDragRef, setCreatePreview, commitTextEdit, connectorFromNodeId, collabConnected, setConnectorFromNodeId, collabCreateConnector, spaceId]
    );

    useEffect(() => {
        let rafId = 0;
        let pendingEvent = null;

        const finishDrag = () => {
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = 0;
            }
            setSnapGuidesIfChangedRef.current([]);
            const ref = nodeDragRef.current;
            if (ref) {
                const ids = ref.dragIds ?? [ref.nodeId];
                const state = useWhiteboardStore.getState();

                useWhiteboardSelectionStore.getState().clearNodeDragPreview();

                updateDragPreviewRef.current({ draggingNodeIds: [], dragPreviewRects: [] });

                const stateAfterPatch = useWhiteboardStore.getState();
                const pageId = stateAfterPatch.activePageId;
                const pageNodes = filterNodesByPage(stateAfterPatch.nodes, pageId);
                const nestPatches = ids
                    .map((id) => {
                        const node = pageNodes.find((n) => n.id === id);
                        if (!node) return null;
                        const container = findDropContainerForNode(node, pageNodes, {
                            frameOnly: true,
                            pageId,
                        });
                        if (!container || node.parentId === container.id) return null;
                        return {
                            id,
                            patch: buildNestInContainerPatch(node, container, pageNodes),
                        };
                    })
                    .filter(Boolean);
                if (nestPatches.length) collabPatchNodesRef.current(nestPatches);

                const stateAfterNest = useWhiteboardStore.getState();
                const byIdAfter = buildNodesById(stateAfterNest.nodes);
                ids.forEach((id) => {
                    const node = stateAfterNest.nodes.find((n) => n.id === id);
                    if (!node?.parentId) return;
                    const parent = stateAfterNest.nodes.find((n) => n.id === node.parentId);
                    if (!parent) return;
                    if (parent.type === 'frame') return;
                    const px = node.x ?? 0;
                    const py = node.y ?? 0;
                    const pw = parent.width ?? 0;
                    const ph = parent.height ?? 0;
                    const w = node.width ?? 0;
                    const h = node.height ?? 0;
                    const inside = px >= 0 && py >= 0 && px + w <= pw && py + h <= ph;
                    if (!inside) {
                        const world = nodeToWorld(node, byIdAfter);
                        collabPatchNodeRef.current(id, {
                            parentId: null,
                            x: world.x,
                            y: world.y,
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
            updateDragPreviewRef.current({ draggingNodeIds: [], dragPreviewRects: [] });
            useWhiteboardSelectionStore.getState().clearNodeDragPreview();
        };

        const flushMove = () => {
            rafId = 0;
            const e = pendingEvent;
            if (!e || resizeActiveRef.current) return;
            const ref = nodeDragRef.current;
            if (!ref || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const vp = viewportRef.current;
            if (!vp || !ref.pointerStartClient) return;
            const startWorld = screenToWorldWithContainer(
                ref.pointerStartClient.x,
                ref.pointerStartClient.y,
                rect,
                vp
            );
            const curWorld = screenToWorldWithContainer(e.clientX, e.clientY, rect, vp);
            const totalDx = curWorld.x - startWorld.x;
            const totalDy = curWorld.y - startWorld.y;
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
                guidesVisible: state.guidesVisible,
                rulerGuides: state.rulerGuides,
                excludeIds: ref.snapExcludeIds,
            });
            setSnapGuidesIfChangedRef.current(snap.guides);
            if (ref.lastOffset?.dx === snap.dx && ref.lastOffset?.dy === snap.dy) return;
            ref.lastOffset = { dx: snap.dx, dy: snap.dy };

            const patches = buildDragFinishPatches(ids, ref.beforeSnapshots, snap, state.nodes);
            if (patches.length) collabPatchNodesRef.current(patches);

            useWhiteboardSelectionStore.getState().setNodeDragPreview({
                ids,
                dx: 0,
                dy: 0,
            });

            const stateAfter = useWhiteboardStore.getState();
            const dragById = buildNodesById(stateAfter.nodes);
            const dragPreviewRects = (ref.beforeSnapshots || [])
                .slice(0, 24)
                .map((entry) => {
                    const node = stateAfter.nodes.find((n) => n.id === entry.id);
                    if (!node) return null;
                    const world = nodeToWorld(node, dragById);
                    return {
                        id: entry.id,
                        x: world.x,
                        y: world.y,
                        width: node.width ?? 0,
                        height: node.height ?? 0,
                        ...dragPreviewBorderFromNode(node),
                    };
                })
                .filter(Boolean);
            updateDragPreviewRef.current({
                draggingNodeIds: ids,
                dragPreviewRects,
            });
        };

        const onMove = (e) => {
            if (resizeActiveRef.current) return;
            pendingEvent = e;
            if (rafId) return;
            rafId = requestAnimationFrame(flushMove);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', finishDrag);
        window.addEventListener('pointercancel', finishDrag);
        return () => {
            if (rafId) cancelAnimationFrame(rafId);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', finishDrag);
            window.removeEventListener('pointercancel', finishDrag);
        };
    }, [collabPatchNodeRef, collabPatchNodesRef, containerRef, nodeDragRef, resizeActiveRef, setSnapGuidesIfChangedRef, updateDragPreviewRef, viewportRef]);

    return {
        handleNodePointerDown,
    };
}
