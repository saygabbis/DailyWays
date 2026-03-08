import React, { useCallback } from 'react';

const HANDLE_SIZE = 10;
const CORNERS = [
    { id: 'nw', cursor: 'nwse-resize', style: { left: 0, top: 0 } },
    { id: 'ne', cursor: 'nesw-resize', style: { right: 0, top: 0 } },
    { id: 'se', cursor: 'nwse-resize', style: { right: 0, bottom: 0 } },
    { id: 'sw', cursor: 'nesw-resize', style: { left: 0, bottom: 0 } },
];

export default function ResizeHandles({ node, onResizeStart, offset }) {
    const handlePointerDown = useCallback(
        (e, corner) => {
            e.stopPropagation();
            e.preventDefault();
            if (e.button !== 0) return;
            onResizeStart?.(node.id, corner, e);
        },
        [node.id, onResizeStart]
    );

    if (!node.width || !node.height) return null;
    const left = offset ? offset.x + node.x : node.x;
    const top = offset ? offset.y + node.y : node.y;

    return (
        <div
            className="whiteboard-resize-handles"
            style={{
                position: 'absolute',
                left,
                top,
                width: node.width,
                height: node.height,
                pointerEvents: 'none',
            }}
        >
            {CORNERS.map(({ id, cursor, style: pos }) => (
                <div
                    key={id}
                    role="button"
                    tabIndex={-1}
                    className="whiteboard-resize-handle"
                    style={{
                        position: 'absolute',
                        width: HANDLE_SIZE,
                        height: HANDLE_SIZE,
                        margin: -HANDLE_SIZE / 2,
                        cursor,
                        pointerEvents: 'auto',
                        ...pos,
                    }}
                    onPointerDown={(e) => handlePointerDown(e, id)}
                />
            ))}
        </div>
    );
}
