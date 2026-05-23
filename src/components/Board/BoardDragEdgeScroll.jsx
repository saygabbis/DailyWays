import { useEffect } from 'react';
import { useBoardEdgeAutoScroll } from '../../hooks/useBoardEdgeAutoScroll';

/**
 * Auto-scroll horizontal do board enquanto um card/lista está a ser arrastado (DnD).
 */
export default function BoardDragEdgeScroll({ scrollerRef }) {
    const { startEdgeScroll, stopEdgeScroll, updatePointer } = useBoardEdgeAutoScroll(scrollerRef);

    useEffect(() => {
        const onMove = (e) => {
            if (!document.body.classList.contains('dnd-dragging')) return;
            updatePointer(e.clientX, e.clientY);
            startEdgeScroll();
        };

        const onDragEnd = () => stopEdgeScroll();

        window.addEventListener('pointermove', onMove, { passive: true });
        window.addEventListener('mousemove', onMove, { passive: true });
        window.addEventListener('pointerup', onDragEnd, true);
        window.addEventListener('pointercancel', onDragEnd, true);

        const observer = new MutationObserver(() => {
            if (!document.body.classList.contains('dnd-dragging')) {
                stopEdgeScroll();
            }
        });
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('pointerup', onDragEnd, true);
            window.removeEventListener('pointercancel', onDragEnd, true);
            observer.disconnect();
            stopEdgeScroll();
        };
    }, [startEdgeScroll, stopEdgeScroll, updatePointer]);

    return null;
}
