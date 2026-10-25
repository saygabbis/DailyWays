/** Caneta: com a ferramenta "draw", arrastar desenha um traço livre que vira um nó vetorial. */
import { useEffect, useRef } from 'react';
import { screenToWorldWithContainer } from '../../interaction/viewport/viewportUtils';
import { buildFreehandNode, pointsToSmoothPath } from '../../core/creation/freehandPath';

/** Áreas do canvas onde o clique continua sendo da interface, não da caneta. */
const UI_SELECTOR = '.whiteboard-bottom-chrome, .whiteboard-viewport-controls, .whiteboard-rulers-horizontal, .whiteboard-rulers-vertical, .whiteboard-pen-bar';

export function useFreehandDraw({ containerRef, viewportRef, active, isSpacePressed, createNodeAt, pen }) {
    const previewRef = useRef(null);
    const penRef = useRef(pen);
    const createRef = useRef(createNodeAt);
    useEffect(() => {
        penRef.current = pen;
        createRef.current = createNodeAt;
    });

    useEffect(() => {
        const el = containerRef.current;
        if (!el || !active || isSpacePressed) return undefined;
        let cleanupStroke = null;

        const onDown = (e) => {
            if (e.button !== 0 || e.target?.closest?.(UI_SELECTOR)) return;
            const vp = viewportRef.current;
            if (!vp) return;
            e.preventDefault();
            e.stopPropagation(); // o gesto é da caneta: nada de seleção por área / criar caixa
            const rect = el.getBoundingClientRect();
            const zoom = vp.zoom || 1;
            const strokeWidth = (penRef.current?.size ?? 3) / zoom;
            const minStep = 1.2 / zoom;
            const points = [screenToWorldWithContainer(e.clientX, e.clientY, rect, vp)];
            const path = previewRef.current;
            path?.setAttribute('stroke-width', String(strokeWidth));
            path?.setAttribute('stroke', penRef.current?.color ?? '#8b5cf6');
            path?.setAttribute('d', pointsToSmoothPath(points));

            const onMove = (ev) => {
                if (ev.pointerId !== e.pointerId) return;
                const batch = typeof ev.getCoalescedEvents === 'function' ? ev.getCoalescedEvents() : [ev];
                for (const ce of batch.length ? batch : [ev]) {
                    const p = screenToWorldWithContainer(ce.clientX, ce.clientY, rect, vp);
                    const last = points[points.length - 1];
                    if (Math.hypot(p.x - last.x, p.y - last.y) >= minStep) points.push(p);
                }
                path?.setAttribute('d', pointsToSmoothPath(points));
            };
            const finish = (ev) => {
                if (ev && ev.pointerId !== e.pointerId) return;
                cleanupStroke?.();
                path?.setAttribute('d', '');
                if (ev?.type === 'pointercancel') return;
                const node = buildFreehandNode(points, { strokeWidth, epsilon: 0.6 / zoom });
                void createRef.current?.(
                    'drawing',
                    node.x,
                    node.y,
                    { data: node.data, style: { stroke: penRef.current?.color ?? '#8b5cf6' } },
                    { width: node.width, height: node.height },
                );
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', finish);
            window.addEventListener('pointercancel', finish);
            cleanupStroke = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', finish);
                window.removeEventListener('pointercancel', finish);
                cleanupStroke = null;
            };
        };

        el.addEventListener('pointerdown', onDown, { capture: true });
        return () => {
            el.removeEventListener('pointerdown', onDown, { capture: true });
            cleanupStroke?.();
        };
    }, [active, isSpacePressed, containerRef, viewportRef]);

    return previewRef;
}
