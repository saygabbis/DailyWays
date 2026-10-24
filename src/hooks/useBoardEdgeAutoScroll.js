import { useRef, useCallback } from 'react';

const BOARD_EDGE_ZONE_PX = 40;
const BOARD_MAX_EDGE_SCROLL_SPEED = 18;

/**
 * Scroll horizontal suave do `.board-scroller` quando o ponteiro encosta nas bordas.
 * Usado no marquee (Shift) e no arrasto de cards/listas (DnD).
 */
export function useBoardEdgeAutoScroll(scrollerRef) {
    const rafRef = useRef(null);
    const pointerRef = useRef({ x: 0, y: 0 });
    const activeRef = useRef(false);

    const stopScrollLoop = useCallback(() => {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    }, []);

    // Função nomeada: o rAF agenda a si mesma sem depender da const ainda não inicializada.
    const scrollLoop = useCallback(function loop() {
        const scroller = scrollerRef.current;
        if (!scroller || !activeRef.current) {
            stopScrollLoop();
            return;
        }

        if (scroller.scrollWidth <= scroller.clientWidth + 1) {
            rafRef.current = requestAnimationFrame(loop);
            return;
        }

        const rect = scroller.getBoundingClientRect();
        const { x, y } = pointerRef.current;

        // Só auto-scroll quando o cursor está na faixa vertical do board
        if (y < rect.top - 48 || y > rect.bottom + 48) {
            rafRef.current = requestAnimationFrame(loop);
            return;
        }

        let delta = 0;
        if (x < rect.left + BOARD_EDGE_ZONE_PX) {
            const t = (rect.left + BOARD_EDGE_ZONE_PX - x) / BOARD_EDGE_ZONE_PX;
            delta = -Math.ceil(BOARD_MAX_EDGE_SCROLL_SPEED * Math.min(1, t));
        } else if (x > rect.right - BOARD_EDGE_ZONE_PX) {
            const t = (x - (rect.right - BOARD_EDGE_ZONE_PX)) / BOARD_EDGE_ZONE_PX;
            delta = Math.ceil(BOARD_MAX_EDGE_SCROLL_SPEED * Math.min(1, t));
        }

        if (delta !== 0) {
            scroller.scrollLeft += delta;
        }

        rafRef.current = requestAnimationFrame(loop);
    }, [scrollerRef, stopScrollLoop]);

    const startEdgeScroll = useCallback(() => {
        activeRef.current = true;
        if (!rafRef.current) {
            rafRef.current = requestAnimationFrame(scrollLoop);
        }
    }, [scrollLoop]);

    const stopEdgeScroll = useCallback(() => {
        activeRef.current = false;
        stopScrollLoop();
    }, [stopScrollLoop]);

    const updatePointer = useCallback((x, y) => {
        pointerRef.current = { x, y };
    }, []);

    return {
        startEdgeScroll,
        stopEdgeScroll,
        updatePointer,
    };
}
