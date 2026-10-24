import { worldBoxFromAnchorWithModifiers } from '../../interaction/transform/createDragBounds';
import { worldToScreenWithContainer } from '../../interaction/viewport/viewportUtils';
import MarqueePreviewOutlines from './MarqueePreviewOutlines';

function MarqueeBox({ left, top, width, height, className = 'whiteboard-selection-box' }) {
    if (width < 2 && height < 2) return null;
    return (
        <div
            className={className}
            style={{
                position: 'absolute',
                left,
                top,
                width,
                height,
                border: '2px solid var(--accent, #4d96ff)',
                backgroundColor: 'rgba(77, 150, 255, 0.1)',
                pointerEvents: 'none',
            }}
        />
    );
}

/**
 * Renders the selection box (marquee) when user drags on empty canvas.
 * Box is in screen coordinates; parent passes selectionBox { start, current }.
 * createPreview: { anchorWorld, currentWorld } in world coords while drag-creating a node.
 */
export default function SelectionManager({ selectionBox, createPreview, viewport, containerRef }) {
    const rect = containerRef?.current?.getBoundingClientRect?.() ?? null;

    if (createPreview && viewport && rect) {
        const box = worldBoxFromAnchorWithModifiers(
            createPreview.anchorWorld,
            createPreview.currentWorld,
            {
                minSize: createPreview.minSize ?? 0,
                shiftKey: createPreview.shiftKey,
                altKey: createPreview.altKey,
                aspectRatio: createPreview.aspectRatio ?? 1,
            }
        );
        const tl = worldToScreenWithContainer(box.x, box.y, rect, viewport);
        const br = worldToScreenWithContainer(box.x + box.width, box.y + box.height, rect, viewport);
        return (
            <MarqueeBox
                className="whiteboard-create-preview"
                left={Math.min(tl.x, br.x) - rect.left}
                top={Math.min(tl.y, br.y) - rect.top}
                width={Math.abs(br.x - tl.x)}
                height={Math.abs(br.y - tl.y)}
            />
        );
    }

    if (!selectionBox || !rect) return null;
    const { start, current } = selectionBox;
    const left = Math.min(start.x, current.x) - rect.left;
    const top = Math.min(start.y, current.y) - rect.top;
    const width = Math.abs(current.x - start.x);
    const height = Math.abs(current.y - start.y);

    return (
        <>
            <MarqueeBox left={left} top={top} width={width} height={height} />
            <MarqueePreviewOutlines
                selectionBox={selectionBox}
                viewport={viewport}
                containerRef={containerRef}
            />
        </>
    );
}
