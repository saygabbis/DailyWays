import React, { useCallback, useMemo } from 'react';
import { useNodeDragTranslate } from '../../interaction/hooks/useNodeDragTranslate';

/** Tamanho visual e área de clique em pixels de tela (compensam zoom do canvas). */
const HANDLE_VISUAL_PX = 10;
const HANDLE_HIT_PAD_PX = 8;

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

const ROTATE_OFFSET_PX = 28;

export default function ResizeHandles({ node, onResizeStart, onRotateStart, offset, zoom = 1, unified = false }) {
    const z = Math.max(0.15, zoom || 1);
    const visualSize = HANDLE_VISUAL_PX / z;
    const hitSize = (HANDLE_VISUAL_PX + HANDLE_HIT_PAD_PX * 2) / z;
    const dragTranslate = useNodeDragTranslate(node.id);

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

    const boxStyle = useMemo(() => {
        const w = Math.max(node.width ?? 0, 1);
        const h = Math.max(node.height ?? 0, 1);
        const dragDx = dragTranslate?.dx ?? 0;
        const dragDy = dragTranslate?.dy ?? 0;
        const baseLeft = (offset ? offset.x + node.x : node.x) + dragDx;
        const baseTop = (offset ? offset.y + node.y : node.y) + dragDy;
        const rot = node.rotation ?? 0;
        return {
            position: 'absolute',
            left: baseLeft + w / 2,
            top: baseTop + h / 2,
            width: w,
            height: h,
            transform: `translate(-50%, -50%)${rot ? ` rotate(${rot}deg)` : ''}`,
            transformOrigin: 'center center',
            pointerEvents: 'none',
            boxSizing: 'border-box',
        };
    }, [node.x, node.y, node.width, node.height, node.rotation, offset, dragTranslate]);

    if ((node.width ?? 0) <= 0 && (node.height ?? 0) <= 0) return null;

    return (
        <div
            className={`whiteboard-resize-handles${unified ? ' whiteboard-resize-handles--unified' : ''}`}
            style={boxStyle}
        >
            <div className="whiteboard-resize-handles-outline" aria-hidden />
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
                        style={{ width: visualSize, height: visualSize }}
                    />
                </div>
            ))}
            {onRotateStart && (
                <>
                    <div
                        className="whiteboard-rotate-stem"
                        style={{ height: ROTATE_OFFSET_PX / z }}
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
                            transform: `translate(-50%, calc(-100% - ${ROTATE_OFFSET_PX / z}px))`,
                            pointerEvents: 'auto',
                        }}
                        title="Rotacionar"
                        onPointerDown={handleRotatePointerDown}
                    >
                        <span
                            className="whiteboard-rotate-handle-visual"
                            style={{ width: visualSize, height: visualSize }}
                        />
                    </div>
                </>
            )}
        </div>
    );
}
