/** Pointer move/up do canvas: atualiza e finaliza seleção por área, gesto de criação e pan. */
import { useCallback } from 'react';
import { useWhiteboardStore } from '../../../../stores/whiteboardStore';
import { CREATE_DRAG_THRESHOLD_PX, creationToolToNodeType } from '../../interaction/hooks/useCreateTool';
import { screenToWorldWithContainer } from '../../interaction/viewport/viewportUtils';
import {
    getZoomAwareCreateDims,
    getZoomAwareMinCreateSize,
} from '../../interaction/viewport/viewportCreation.js';
import { resolveMarqueeSelectionIds } from '../../core/selection/whiteboardSelectionUtils';
import { getNodeCreateOffset } from '../../core/whiteboardCreateOffsets';
import { applyPostCreateActions } from '../../core/creation/postCreateActions';

export function useCanvasPointerGestures(ctx) {
    const {
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
    } = ctx;

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
                const defaultKey =
                    nodeType === 'drawing' ? 'draw' : nodeType === 'file_card' ? 'file' : nodeType;
                const zoom = viewportForChildren.zoom ?? 1;
                const aware = getZoomAwareCreateDims(defaultKey, zoom);
                const [ox, oy] = getNodeCreateOffset(defaultKey, zoom);
                const id = await createNodeAt(
                    nodeType,
                    drag.anchorWorld.x - ox,
                    drag.anchorWorld.y - oy,
                    {},
                    aware
                );
                if (id) {
                    applyPostCreateActions({
                        nodeId: id,
                        nodeType,
                        keepCreationTool: keepCreationToolRef.current,
                    });
                }
            } else {
                await applyCreateDragBox(drag, currentWorld, {
                    shiftKey: e.shiftKey,
                    altKey: e.altKey,
                });
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
            if ((e.buttons & 2) === 0) rightMousePanRef.current = false;
            if (e.button === 0) {
                keepCreationToolRef.current = e.ctrlKey || e.metaKey;
                const rect = containerRef.current?.getBoundingClientRect();
                const drag = createDragRef.current;
                const dragStart = drag?.startScreen;
                const isClickInControls =
                    dragStart &&
                    (document.elementFromPoint(dragStart.x, dragStart.y)?.closest?.(
                        '.whiteboard-viewport-controls, .whiteboard-bottom-dock, .whiteboard-bottom-chrome'
                    ) ??
                        false);
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
                            const zoom = viewportForChildren.zoom ?? 1;
                            const aware = getZoomAwareCreateDims(defaultKey, zoom);
                            const [ox, oy] = getNodeCreateOffset(drag.tool || defaultKey, zoom);
                            const id = await createNodeAt(nodeType, w1.x - ox, w1.y - oy, {}, aware);
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
                            clearGuideSelection();
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
                            const { nodes, activePageId } = useWhiteboardStore.getState();
                            clearGuideSelection();
                            setSelection(resolveMarqueeSelectionIds(nodes, box, activePageId));
                        }
                    }
                    setSelectionBox(null);
                }
            }
            viewportState.handleMouseUp();
        },
        [selectionBox, viewportForChildren, setSelection, clearGuideSelection, activeTool, createNodeAt, finalizeCreateDrag]
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
                    const modifiers = { shiftKey: e.shiftKey, altKey: e.altKey };
                    const zoom = viewportRef.current?.zoom ?? 1;
                    setCreatePreview({
                        anchorWorld: drag.anchorWorld,
                        currentWorld,
                        shiftKey: modifiers.shiftKey,
                        altKey: modifiers.altKey,
                        aspectRatio: drag.aspectRatio ?? 1,
                        minSize: getZoomAwareMinCreateSize(zoom),
                    });
                    const dist = Math.hypot(
                        e.clientX - drag.startScreen.x,
                        e.clientY - drag.startScreen.y
                    );
                    if (dist >= CREATE_DRAG_THRESHOLD_PX) {
                        void applyCreateDragBox(drag, currentWorld, modifiers);
                    }
                }
            } else {
                viewportState.handleMouseMove(e);
            }
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect && viewportRef.current) {
                const world = screenToWorldWithContainer(e.clientX, e.clientY, rect, viewportRef.current);
                updateCursor({ x: world.x, y: world.y });
            }
        },
        [selectionBox, viewportState, updateCursor, applyCreateDragBox]
    );

    return {
        handlePointerUp,
        handlePointerMove,
    };
}
