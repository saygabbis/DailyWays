import React from 'react';
import './RulerGuidesOverlay.css';

const EXTENT = 20000;

/**
 * Linhas guia persistentes (coordenadas mundo).
 * @param {{ guides: Array, selectedGuideIds: string[], lockedGuideIds: string[], preview?: { axis, position }|null, onGuidePointerDown?: Function }}
 */
export default function RulerGuidesOverlay({
    guides = [],
    selectedGuideIds = [],
    lockedGuideIds = [],
    preview = null,
    onGuidePointerDown,
}) {
    const selectedSet = new Set(selectedGuideIds);
    const lockedSet = new Set(lockedGuideIds);
    const all = [...guides];
    if (preview?.axis && Number.isFinite(preview.position)) {
        all.push({ id: '__preview__', axis: preview.axis, position: preview.position, isPreview: true });
    }

    if (!all.length) return null;

    return (
        <div className="whiteboard-ruler-guides-layer" aria-hidden={false}>
            {all.map((g) => {
                const isPreview = g.isPreview || g.id === '__preview__';
                const isSelected = !isPreview && selectedSet.has(g.id);
                const isLocked = !isPreview && lockedSet.has(g.id);
                const className = [
                    'whiteboard-ruler-guide',
                    g.axis === 'x' ? 'whiteboard-ruler-guide--v' : 'whiteboard-ruler-guide--h',
                    isSelected ? 'whiteboard-ruler-guide--selected' : '',
                    isLocked ? 'whiteboard-ruler-guide--locked' : '',
                    isPreview ? 'whiteboard-ruler-guide--preview' : '',
                ]
                    .filter(Boolean)
                    .join(' ');

                const style =
                    g.axis === 'x'
                        ? { left: g.position, top: -EXTENT, height: EXTENT * 2 }
                        : { top: g.position, left: -EXTENT, width: EXTENT * 2 };

                return (
                    <div
                        key={isPreview ? 'preview' : g.id}
                        className={className}
                        style={style}
                        data-guide-id={isPreview ? undefined : g.id}
                        onPointerDown={
                            isPreview || isLocked || !onGuidePointerDown
                                ? undefined
                                : (e) => onGuidePointerDown(e, g.id)
                        }
                    />
                );
            })}
        </div>
    );
}
