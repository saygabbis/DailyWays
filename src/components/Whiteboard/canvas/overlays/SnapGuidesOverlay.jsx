import React from 'react';
import './SnapGuidesOverlay.css';

const EXTENT = 20000;

/** Guias em coordenadas mundo (dentro de .whiteboard-canvas-transform). */
export default function SnapGuidesOverlay({ guides }) {
    if (!guides?.length) return null;

    return (
        <div className="whiteboard-snap-guides" aria-hidden>
            {guides.map((g, i) => {
                if (g.axis === 'x') {
                    return (
                        <div
                            key={`v-${i}-${g.pos}`}
                            className="whiteboard-snap-guide whiteboard-snap-guide--v"
                            style={{ left: g.pos, top: -EXTENT, height: EXTENT * 2 }}
                        />
                    );
                }
                return (
                    <div
                        key={`h-${i}-${g.pos}`}
                        className="whiteboard-snap-guide whiteboard-snap-guide--h"
                        style={{ top: g.pos, left: -EXTENT, width: EXTENT * 2 }}
                    />
                );
            })}
        </div>
    );
}
