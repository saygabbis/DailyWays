/** Pointer down no fundo do canvas: pan (espaço/botão do meio/direito), início de seleção por área e início do gesto de criação. */
import { useCallback } from 'react';
import { isCreationTool } from '../../../../stores/whiteboardStore';
import { creationToolToNodeType } from '../../interaction/hooks/useCreateTool';
import { screenToWorldWithContainer } from '../../interaction/viewport/viewportUtils';
import {
    getZoomAwareCreateDims,
    getZoomAwareMinCreateSize,
} from '../../interaction/viewport/viewportCreation.js';
import { NODE_TYPES_ALLOWED } from '../../shared/constants';

export function useCanvasPointerDown(ctx) {
    const {
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
    } = ctx;

    const handlePointerDown = useCallback(
        (e) => {
            if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
            const isBg = isCanvasBackground(e);
            if (e.button === 2 || e.button === 1 || (e.button === 0 && isSpacePressed)) {
                e.preventDefault();
                e.stopPropagation();
                rightMousePanRef.current = e.button === 2;
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
                if (activeTool === 'select' && tryPickGuideOnBackground(e)) {
                    return;
                }
                if (activeTool === 'select') {
                    clearGuideSelection();
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
        [isCanvasBackground, isSpacePressed, rightMousePanRef, viewportState, containerRef, commitTextEdit, activeTool, tryPickGuideOnBackground, isDragCreationTool, clearGuideSelection, setSelectionBox, viewportForChildren, createDragRef, setCreatePreview]
    );

    return {
        handlePointerDown,
    };
}
