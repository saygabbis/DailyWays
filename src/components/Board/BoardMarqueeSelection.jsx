import { useEffect, useRef, useCallback, useState } from 'react';
import { useBoardSelectionStore } from '../../stores/boardSelectionStore';

const EDGE_ZONE_PX = 40;
const MAX_SCROLL_SPEED = 18;

function MarqueeBox({ left, top, width, height }) {
    if (width < 2 && height < 2) return null;
    return (
        <div
            className="board-selection-marquee"
            style={{
                position: 'fixed',
                left,
                top,
                width,
                height,
                pointerEvents: 'none',
                zIndex: 9998,
            }}
        />
    );
}

function rectsIntersect(a, b) {
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

export default function BoardMarqueeSelection({ scrollerRef }) {
    const selectMany = useBoardSelectionStore((s) => s.selectMany);
    const clearSelection = useBoardSelectionStore((s) => s.clearSelection);
    const setShiftSelecting = useBoardSelectionStore((s) => s.setShiftSelecting);
    const [box, setBox] = useState(null);
    const activeRef = useRef(false);
    const startRef = useRef({ x: 0, y: 0 });
    const rafRef = useRef(null);
    const pointerRef = useRef({ x: 0, y: 0 });
    const shiftHeldRef = useRef(false);

    const stopScrollLoop = useCallback(() => {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    }, []);

    const scrollLoop = useCallback(() => {
        const scroller = scrollerRef.current;
        if (!scroller || !activeRef.current) {
            stopScrollLoop();
            return;
        }
        const rect = scroller.getBoundingClientRect();
        const { x } = pointerRef.current;
        let delta = 0;
        if (x < rect.left + EDGE_ZONE_PX) {
            const t = (rect.left + EDGE_ZONE_PX - x) / EDGE_ZONE_PX;
            delta = -Math.ceil(MAX_SCROLL_SPEED * Math.min(1, t));
        } else if (x > rect.right - EDGE_ZONE_PX) {
            const t = (x - (rect.right - EDGE_ZONE_PX)) / EDGE_ZONE_PX;
            delta = Math.ceil(MAX_SCROLL_SPEED * Math.min(1, t));
        }
        if (delta !== 0) {
            scroller.scrollLeft += delta;
        }
        rafRef.current = requestAnimationFrame(scrollLoop);
    }, [scrollerRef, stopScrollLoop]);

    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.key === 'Shift') {
                shiftHeldRef.current = true;
                setShiftSelecting(true);
            }
        };
        const onKeyUp = (e) => {
            if (e.key === 'Shift') {
                shiftHeldRef.current = false;
                setShiftSelecting(false);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            setShiftSelecting(false);
        };
    }, [setShiftSelecting]);

    useEffect(() => {
        const onPointerDown = (e) => {
            if (!e.shiftKey || e.pointerType === 'touch') return;
            if (e.button !== 0) return;
            const target = e.target;
            if (target.closest('.board-toolbar, button, input, textarea, a')) return;

            activeRef.current = true;
            startRef.current = { x: e.clientX, y: e.clientY };
            pointerRef.current = { x: e.clientX, y: e.clientY };
            setBox({ start: startRef.current, current: startRef.current });
            setShiftSelecting(true);
            e.preventDefault();

            if (!rafRef.current) {
                rafRef.current = requestAnimationFrame(scrollLoop);
            }
        };

        const onPointerMove = (e) => {
            if (!activeRef.current) return;
            pointerRef.current = { x: e.clientX, y: e.clientY };
            setBox({ start: startRef.current, current: { x: e.clientX, y: e.clientY } });
        };

        const finish = () => {
            if (!activeRef.current) return;
            activeRef.current = false;
            stopScrollLoop();

            const start = startRef.current;
            const current = pointerRef.current;
            const selRect = {
                left: Math.min(start.x, current.x),
                top: Math.min(start.y, current.y),
                right: Math.max(start.x, current.x),
                bottom: Math.max(start.y, current.y),
            };

            const ids = [];
            document.querySelectorAll('.board-card[data-card-id]').forEach((el) => {
                const r = el.getBoundingClientRect();
                if (rectsIntersect(selRect, r)) {
                    ids.push(el.getAttribute('data-card-id'));
                }
            });

            if (ids.length > 0) {
                selectMany(ids);
            } else if (Math.abs(current.x - start.x) > 4 || Math.abs(current.y - start.y) > 4) {
                clearSelection();
            }

            setBox(null);
            if (!shiftHeldRef.current) {
                setShiftSelecting(false);
            }
        };

        const onPointerUp = () => finish();
        const onKeyUpMarquee = (e) => {
            if (e.key === 'Shift' && activeRef.current) finish();
        };

        window.addEventListener('pointerdown', onPointerDown, true);
        window.addEventListener('pointermove', onPointerMove, true);
        window.addEventListener('pointerup', onPointerUp, true);
        window.addEventListener('pointercancel', onPointerUp, true);
        window.addEventListener('keyup', onKeyUpMarquee);

        return () => {
            window.removeEventListener('pointerdown', onPointerDown, true);
            window.removeEventListener('pointermove', onPointerMove, true);
            window.removeEventListener('pointerup', onPointerUp, true);
            window.removeEventListener('pointercancel', onPointerUp, true);
            window.removeEventListener('keyup', onKeyUpMarquee);
            stopScrollLoop();
        };
    }, [selectMany, clearSelection, setShiftSelecting, scrollLoop, stopScrollLoop]);

    if (!box) return null;
    const { start, current } = box;
    const left = Math.min(start.x, current.x);
    const top = Math.min(start.y, current.y);
    const width = Math.abs(current.x - start.x);
    const height = Math.abs(current.y - start.y);

    return <MarqueeBox left={left} top={top} width={width} height={height} />;
}
