import React, { useLayoutEffect, useRef } from 'react';
import LeftToolbar from './LeftToolbar';
import ViewportControlsBar from './ViewportControlsBar';
import './WhiteboardBottomChrome.css';

const TOOLBAR_CONTROLS_GAP_PX = 12;

/**
 * Barra inferior do canvas: toolbar centralizada + controles de vista
 * imediatamente à direita da toolbar (antes do inspector).
 */
export default function WhiteboardBottomChrome({ toolbarProps, viewportControlsProps }) {
    const chromeRef = useRef(null);
    const toolbarRef = useRef(null);

    useLayoutEffect(() => {
        const chrome = chromeRef.current;
        const toolbar = toolbarRef.current;
        if (!chrome || !toolbar) return;

        const sync = () => {
            const half = toolbar.offsetWidth / 2;
            chrome.style.setProperty('--toolbar-half-width', `${half}px`);
            chrome.style.setProperty('--toolbar-controls-gap', `${TOOLBAR_CONTROLS_GAP_PX}px`);
        };

        sync();
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null;
        ro?.observe(toolbar);
        window.addEventListener('resize', sync);
        return () => {
            ro?.disconnect();
            window.removeEventListener('resize', sync);
        };
    }, []);

    return (
        <div
            ref={chromeRef}
            className="whiteboard-bottom-chrome"
            onPointerDown={(e) => e.stopPropagation()}
        >
            <div ref={toolbarRef} className="whiteboard-bottom-chrome__toolbar">
                <LeftToolbar variant="bottom" {...toolbarProps} />
            </div>
            <ViewportControlsBar {...viewportControlsProps} />
        </div>
    );
}
