import { useCallback, useMemo, useState, useEffect } from 'react';
import { useNodeDragTranslate } from '../../interaction/hooks/useNodeDragTranslate';
import { clampViewportZoom } from '../../interaction/viewport/viewportLimits.js';
import { WORLD_DIM_EPSILON } from '../../shared/vectorViewport.js';
import { worldToScreenWithContainer } from '../../interaction/viewport/viewportUtils';

/** Tamanho visual e área de clique em pixels de ecrã. */
const HANDLE_VISUAL_PX = 10;
const HANDLE_HIT_PAD_PX = 8;
const OUTLINE_BORDER_PX = 2;
const HANDLE_STROKE_PX = 2;
const ROTATE_OFFSET_PX = 28;

const HANDLES = [
    { id: 'nw', cursor: 'nwse-resize', left: '0%', top: '0%' },
    { id: 'n', cursor: 'ns-resize', left: '50%', top: '0%' },
    { id: 'ne', cursor: 'nesw-resize', left: '100%', top: '0%' },
    { id: 'e', cursor: 'ew-resize', left: '100%', top: '50%' },
    { id: 'se', cursor: 'nwse-resize', left: '100%', top: '100%' },
    { id: 's', cursor: 'ns-resize', left: '50%', top: '100%' },
    { id: 'sw', cursor: 'nesw-resize', left: '0%', top: '100%' },
    { id: 'w', cursor: 'ew-resize', left: '0%', top: '50%' },
];

function useContainerRect(containerRef) {
    const [rect, setRect] = useState(null);

    useEffect(() => {
        const el = containerRef?.current;
        if (!el) {
            setRect(null);
            return undefined;
        }
        const update = () => setRect(el.getBoundingClientRect());
        update();
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
        ro?.observe(el);
        window.addEventListener('scroll', update, true);
        window.addEventListener('resize', update);
        return () => {
            ro?.disconnect();
            window.removeEventListener('scroll', update, true);
            window.removeEventListener('resize', update);
        };
    }, [containerRef]);

    return rect;
}

export default function ResizeHandles({
    node,
    viewport,
    containerRef,
    onResizeStart,
    onRotateStart,
    unified = false,
}) {
    const containerRect = useContainerRect(containerRef);
    const dragTranslate = useNodeDragTranslate(node.id);
    const zoom = clampViewportZoom(viewport?.zoom ?? 1);

    const hitSize = HANDLE_VISUAL_PX + HANDLE_HIT_PAD_PX * 2;

    const screenBox = useMemo(() => {
        if (!containerRect || !viewport) return null;
        const w = Math.max(node.width ?? 0, WORLD_DIM_EPSILON);
        const h = Math.max(node.height ?? 0, WORLD_DIM_EPSILON);
        const dragDx = dragTranslate?.dx ?? 0;
        const dragDy = dragTranslate?.dy ?? 0;
        const wx = (node.x ?? 0) + dragDx;
        const wy = (node.y ?? 0) + dragDy;
        const center = worldToScreenWithContainer(wx + w / 2, wy + h / 2, containerRect, viewport);
        return {
            left: center.x - containerRect.left,
            top: center.y - containerRect.top,
            width: w * zoom,
            height: h * zoom,
            rotation: node.rotation ?? 0,
        };
    }, [
        containerRect,
        viewport,
        node.x,
        node.y,
        node.width,
        node.height,
        node.rotation,
        dragTranslate,
        zoom,
    ]);

    const handlePointerDown = useCallback(
        (e, handleId) => {
            e.stopPropagation();
            e.preventDefault();
            if (e.button !== 0) return;
            onResizeStart?.(node.id, handleId, e);
        },
        [node.id, onResizeStart]
    );

    const handleRotatePointerDown = useCallback(
        (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (e.button !== 0) return;
            onRotateStart?.(node.id, e);
        },
        [node.id, onRotateStart]
    );

    if ((node.width ?? 0) <= 0 && (node.height ?? 0) <= 0) return null;
    if (!screenBox) return null;

    const rot = screenBox.rotation;
    const boxStyle = {
        position: 'absolute',
        left: screenBox.left,
        top: screenBox.top,
        width: screenBox.width,
        height: screenBox.height,
        transform: `translate(-50%, -50%)${rot ? ` rotate(${rot}deg)` : ''}`,
        transformOrigin: 'center center',
        pointerEvents: 'none',
        boxSizing: 'border-box',
    };

    return (
        <div
            className={`whiteboard-resize-handles whiteboard-resize-handles--screen${unified ? ' whiteboard-resize-handles--unified' : ''}`}
            style={boxStyle}
        >
            <div
                className="whiteboard-resize-handles-outline"
                style={{
                    borderWidth: OUTLINE_BORDER_PX,
                    ...(unified
                        ? {
                              boxShadow:
                                  '0 0 0 1px color-mix(in srgb, var(--accent, #4d96ff) 25%, transparent)',
                          }
                        : null),
                }}
                aria-hidden
            />
            {HANDLES.map(({ id, cursor, left, top }) => (
                <div
                    key={id}
                    role="button"
                    tabIndex={-1}
                    className="whiteboard-resize-handle"
                    style={{
                        position: 'absolute',
                        left,
                        top,
                        width: hitSize,
                        height: hitSize,
                        transform: 'translate(-50%, -50%)',
                        cursor,
                        pointerEvents: 'auto',
                    }}
                    onPointerDown={(e) => handlePointerDown(e, id)}
                >
                    <span
                        className="whiteboard-resize-handle-visual"
                        style={{
                            width: HANDLE_VISUAL_PX,
                            height: HANDLE_VISUAL_PX,
                            borderWidth: HANDLE_STROKE_PX,
                        }}
                    />
                </div>
            ))}
            {onRotateStart && (
                <>
                    <div
                        className="whiteboard-rotate-stem"
                        style={{ height: ROTATE_OFFSET_PX, width: 2 }}
                        aria-hidden
                    />
                    <div
                        role="button"
                        tabIndex={-1}
                        className="whiteboard-rotate-handle"
                        style={{
                            position: 'absolute',
                            left: '50%',
                            top: 0,
                            width: hitSize,
                            height: hitSize,
                            transform: `translate(-50%, calc(-100% - ${ROTATE_OFFSET_PX}px))`,
                            pointerEvents: 'auto',
                        }}
                        title="Rotacionar"
                        onPointerDown={handleRotatePointerDown}
                    >
                        <span
                            className="whiteboard-rotate-handle-visual"
                            style={{
                                width: HANDLE_VISUAL_PX,
                                height: HANDLE_VISUAL_PX,
                                borderWidth: HANDLE_STROKE_PX,
                            }}
                        />
                    </div>
                </>
            )}
        </div>
    );
}
