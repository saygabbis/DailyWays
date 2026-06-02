import React, { useEffect, useRef, useState } from 'react';
import './ViewportControlsBar.css';
import {
    Grid3X3,
    ZoomIn,
    ZoomOut,
    Ruler,
    Magnet,
    HelpCircle,
    Focus,
    Crosshair,
    SlidersHorizontal,
} from 'lucide-react';
import { formatViewportZoomPercent } from '../interaction/viewport/viewportLimits.js';

function ViewportControlButtons({
    viewportState,
    gridVisible,
    setGridVisible,
    rulersVisible,
    setRulersVisible,
    guidesVisible,
    setGuidesVisible,
    snapEnabled,
    setSnapEnabled,
    setSnapGuidesIfChangedRef,
    getZoomFocalClient,
    onOpenShortcuts,
    vertical,
}) {
    const dividerClass = vertical
        ? 'whiteboard-viewport-controls-divider whiteboard-viewport-controls-divider--h'
        : 'whiteboard-viewport-controls-divider';

    return (
        <>
            <button
                type="button"
                title="Centralizar vista"
                onClick={() => viewportState.setViewport({ x: 0, y: 0 }, 1)}
            >
                <Focus size={18} />
            </button>
            <span className={dividerClass} aria-hidden />
            <button
                type="button"
                title={gridVisible ? 'Ocultar grade' : 'Mostrar grade'}
                className={gridVisible ? 'active' : ''}
                onClick={() => setGridVisible(!gridVisible)}
            >
                <Grid3X3 size={18} />
            </button>
            <button
                type="button"
                title={rulersVisible ? 'Ocultar réguas (Ctrl+R)' : 'Mostrar réguas (Ctrl+R)'}
                className={rulersVisible ? 'active' : ''}
                onClick={() => setRulersVisible(!rulersVisible)}
            >
                <Ruler size={18} />
            </button>
            <button
                type="button"
                title={guidesVisible ? 'Ocultar guias de régua' : 'Mostrar guias de régua'}
                className={guidesVisible ? 'active' : ''}
                onClick={() => setGuidesVisible(!guidesVisible)}
            >
                <Crosshair size={18} />
            </button>
            <button
                type="button"
                title={snapEnabled ? 'Desativar imã (alinhamento)' : 'Ativar imã (alinhamento)'}
                className={snapEnabled ? 'active' : ''}
                onClick={() => {
                    const next = !snapEnabled;
                    setSnapEnabled(next);
                    if (!next) setSnapGuidesIfChangedRef.current([]);
                }}
            >
                <Magnet size={18} />
            </button>
            <button
                type="button"
                title="Diminuir zoom"
                onClick={() => {
                    const { x, y } = getZoomFocalClient();
                    viewportState.zoomAtClient(x, y, 1 / 1.2);
                }}
            >
                <ZoomOut size={18} />
            </button>
            <span className="zoom-label">{formatViewportZoomPercent(viewportState.zoom)}</span>
            <button
                type="button"
                title="Aumentar zoom"
                onClick={() => {
                    const { x, y } = getZoomFocalClient();
                    viewportState.zoomAtClient(x, y, 1.2);
                }}
            >
                <ZoomIn size={18} />
            </button>
            <button type="button" title="Atalhos (?)" onClick={onOpenShortcuts}>
                <HelpCircle size={18} />
            </button>
        </>
    );
}

export default function ViewportControlsBar({
    viewportState,
    gridVisible,
    setGridVisible,
    rulersVisible,
    setRulersVisible,
    guidesVisible,
    setGuidesVisible,
    snapEnabled,
    setSnapEnabled,
    setSnapGuidesIfChangedRef,
    getZoomFocalClient,
    onOpenShortcuts,
}) {
    const [compactOpen, setCompactOpen] = useState(false);
    const rootRef = useRef(null);

    useEffect(() => {
        if (!compactOpen) return;
        const onPointerDown = (e) => {
            if (!rootRef.current?.contains(e.target)) setCompactOpen(false);
        };
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [compactOpen]);

    const controlProps = {
        viewportState,
        gridVisible,
        setGridVisible,
        rulersVisible,
        setRulersVisible,
        guidesVisible,
        setGuidesVisible,
        snapEnabled,
        setSnapEnabled,
        setSnapGuidesIfChangedRef,
        getZoomFocalClient,
        onOpenShortcuts,
    };

    return (
        <div
            ref={rootRef}
            className={`whiteboard-viewport-controls${compactOpen ? ' whiteboard-viewport-controls--open' : ''}`}
            onPointerDown={(e) => e.stopPropagation()}
        >
            <button
                type="button"
                className="whiteboard-viewport-controls__toggle"
                title={compactOpen ? 'Fechar controles da vista' : 'Controles da vista'}
                aria-expanded={compactOpen}
                aria-controls="whiteboard-viewport-controls-panel"
                onClick={() => setCompactOpen((v) => !v)}
            >
                <SlidersHorizontal size={18} />
            </button>
            <div
                id="whiteboard-viewport-controls-panel"
                className="whiteboard-viewport-controls__panel"
                role="toolbar"
                aria-label="Controles da vista"
            >
                <div className="whiteboard-viewport-controls__panel-row">
                    <ViewportControlButtons {...controlProps} vertical={false} />
                </div>
                <div className="whiteboard-viewport-controls__panel-stack">
                    <ViewportControlButtons {...controlProps} vertical />
                </div>
            </div>
        </div>
    );
}
