/** Pan horizontal do board com o mouse (arrastar o fundo) e repaint em scroll/resize para overlays de presença. */
import { useState, useRef, useEffect } from 'react';

export function useBoardPanning(ctx) {
    const {
        board,
        clearSelection,
        scrollerRef,
    } = ctx;

    const [layoutRepaint, setLayoutRepaint] = useState(0);
    const [isPanning, setIsPanning] = useState(false);
    const panningData = useRef({
        isDown: false,
        startX: 0,
        scrollLeft: 0,
        moved: false
    });

    useEffect(() => {
        const el = scrollerRef.current;
        if (!el || !board?.id) return undefined;
        const bump = () => setLayoutRepaint((n) => n + 1);
        el.addEventListener('scroll', bump, { passive: true });
        const ro = new ResizeObserver(bump);
        ro.observe(el);
        window.addEventListener('resize', bump, { passive: true });
        return () => {
            el.removeEventListener('scroll', bump);
            ro.disconnect();
            window.removeEventListener('resize', bump);
        };
    }, [board?.id]);

    // Pan horizontal só com mouse — no touch o scroll nativo do .board-scroller não conflita com o DnD
    const handlePanPointerDown = (e) => {
        if (e.pointerType !== 'mouse') return;
        if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
        if (e.shiftKey) return;
        const target = e.target;
        const isInteractive = target.closest('button, a, input, textarea, .board-card, .board-list-header, .board-list-footer');
        if (isInteractive) return;

        if (!e.shiftKey && !target.closest('.board-card')) {
            clearSelection();
        }

        panningData.current = {
            isDown: true,
            startX: e.pageX,
            scrollLeft: scrollerRef.current.scrollLeft,
            moved: false
        };
        setIsPanning(true);
        if (e.button === 1) e.preventDefault();

        const onMove = (ev) => {
            if (ev.pointerType !== 'mouse' || !panningData.current.isDown) return;
            ev.preventDefault();
            const walk = (ev.pageX - panningData.current.startX) * 1;
            scrollerRef.current.scrollLeft = panningData.current.scrollLeft - walk;
            if (Math.abs(walk) > 5) panningData.current.moved = true;
        };
        const onUp = () => {
            panningData.current.isDown = false;
            setIsPanning(false);
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            document.removeEventListener('pointercancel', onUp);
        };
        document.addEventListener('pointermove', onMove, { passive: false });
        document.addEventListener('pointerup', onUp);
        document.addEventListener('pointercancel', onUp);
    };

    // Pan com o botão direito não deve abrir o menu de contexto ao soltar.
    const handleContextMenu = (e) => {
        if (panningData.current.moved) {
            e.preventDefault();
            panningData.current.moved = false;
        }
    };

    return {
        layoutRepaint,
        isPanning,
        handlePanPointerDown,
        handleContextMenu,
    };
}
