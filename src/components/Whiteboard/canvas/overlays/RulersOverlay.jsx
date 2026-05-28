import React, { useMemo, useCallback } from 'react';
import { screenToWorldWithContainer } from '../../interaction/viewport/viewportUtils';
import './RulersOverlay.css';

const RULER_SIZE = 22;

function pickWorldStep(zoom) {
    const targetPx = 56;
    const steps = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500];
    for (const s of steps) {
        if (s * zoom >= targetPx) return s;
    }
    return steps[steps.length - 1];
}

function buildTicks(minWorld, maxWorld, step) {
    const start = Math.floor(minWorld / step) * step;
    const ticks = [];
    for (let v = start; v <= maxWorld + step; v += step) {
        if (v >= minWorld - step && v <= maxWorld + step) ticks.push(v);
    }
    return ticks;
}

export default function RulersOverlay({
    viewport,
    containerRef,
    interactive = false,
    onRulerPointerDown,
}) {
    const layout = useMemo(() => {
        const rect = containerRef?.current?.getBoundingClientRect();
        if (!rect || !viewport) return null;
        const step = pickWorldStep(viewport.zoom);
        const tl = screenToWorldWithContainer(rect.left + RULER_SIZE, rect.top + RULER_SIZE, rect, viewport);
        const br = screenToWorldWithContainer(rect.right, rect.bottom, rect, viewport);
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const hTicks = buildTicks(tl.x, br.x, step).map((worldX) => ({
            world: worldX,
            px: cx + viewport.panX + worldX * viewport.zoom,
        }));
        const vTicks = buildTicks(tl.y, br.y, step).map((worldY) => ({
            world: worldY,
            px: cy + viewport.panY + worldY * viewport.zoom,
        }));

        return { rect, hTicks, vTicks, step };
    }, [viewport?.panX, viewport?.panY, viewport?.zoom, containerRef]);

    const stopBubble = useCallback((e) => {
        e.stopPropagation();
    }, []);

    const handleHDown = useCallback(
        (e) => {
            if (!interactive || e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            onRulerPointerDown?.('y', e);
        },
        [interactive, onRulerPointerDown]
    );

    const handleVDown = useCallback(
        (e) => {
            if (!interactive || e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            onRulerPointerDown?.('x', e);
        },
        [interactive, onRulerPointerDown]
    );

    if (!layout) return null;
    const { rect, hTicks, vTicks } = layout;

    return (
        <div className={`whiteboard-rulers ${interactive ? 'whiteboard-rulers--interactive' : ''}`} aria-hidden={!interactive}>
            <div className="whiteboard-rulers-corner" onPointerDown={stopBubble} />
            <div
                className="whiteboard-rulers-horizontal"
                onPointerDown={handleHDown}
            >
                {hTicks.map((t) => {
                    const left = t.px - rect.left;
                    if (left < RULER_SIZE || left > rect.width) return null;
                    return (
                        <div
                            key={`h-${t.world}`}
                            className="whiteboard-ruler-tick-h"
                            style={{ left }}
                        >
                            <span className="whiteboard-ruler-label">
                                {Math.abs(t.world) >= 1000 ? `${t.world / 1000}k` : Math.round(t.world)}
                            </span>
                        </div>
                    );
                })}
            </div>
            <div
                className="whiteboard-rulers-vertical"
                onPointerDown={handleVDown}
            >
                {vTicks.map((t) => {
                    const top = t.px - rect.top;
                    if (top < RULER_SIZE || top > rect.height) return null;
                    return (
                        <div
                            key={`v-${t.world}`}
                            className="whiteboard-ruler-tick-v"
                            style={{ top }}
                        >
                            <span className="whiteboard-ruler-label">
                                {Math.abs(t.world) >= 1000 ? `${t.world / 1000}k` : Math.round(t.world)}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export { RULER_SIZE };
