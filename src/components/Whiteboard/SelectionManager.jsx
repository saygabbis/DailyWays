import React from 'react';

/**
 * Renders the selection box (marquee) when user drags on empty canvas.
 * Box is in screen coordinates; parent passes selectionBox { start, current }.
 */
export default function SelectionManager({ selectionBox }) {
    if (!selectionBox) return null;
    const { start, current } = selectionBox;
    const left = Math.min(start.x, current.x);
    const top = Math.min(start.y, current.y);
    const width = Math.abs(current.x - start.x);
    const height = Math.abs(current.y - start.y);

    if (width < 2 && height < 2) return null;

    return (
        <div
            className="whiteboard-selection-box"
            style={{
                position: 'fixed',
                left,
                top,
                width,
                height,
                border: '2px solid var(--accent, #4d96ff)',
                backgroundColor: 'rgba(77, 150, 255, 0.1)',
                pointerEvents: 'none',
                zIndex: 9999,
            }}
        />
    );
}
