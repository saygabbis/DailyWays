import React, { useRef, useState, useCallback, useEffect } from 'react';

/**
 * Handles pan and zoom for the canvas (Miro-style).
 * Wheel = zoom. Space + drag = pan. Middle mouse + drag = pan.
 */
export function useViewport(initialPan = { x: 0, y: 0 }, initialZoom = 1, onViewportChange) {
    const [pan, setPan] = useState(initialPan);
    const [zoom, setZoom] = useState(initialZoom);
    const [isPanning, setIsPanning] = useState(false);
    const lastMousePos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        setPan(initialPan);
        setZoom(initialZoom);
    }, [initialPan.x, initialPan.y, initialZoom]);

    const persist = useCallback(
        (newPan, newZoom) => {
            if (onViewportChange) onViewportChange(newPan, newZoom);
        },
        [onViewportChange]
    );

    const handleWheel = useCallback(
        (e) => {
            e.preventDefault();
            e.stopPropagation();
            const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
            const newZoom = Math.min(Math.max(0.1, zoom * zoomDelta), 5);
            setZoom(newZoom);
            persist(pan, newZoom);
        },
        [pan, zoom, persist]
    );

    const handleMouseDown = useCallback(
        (e, isCanvasBackground, isSpacePressed) => {
            const startPan = (e.button === 1) || (e.button === 0 && isCanvasBackground && isSpacePressed);
            if (startPan) {
                e.preventDefault();
                setIsPanning(true);
                lastMousePos.current = { x: e.clientX, y: e.clientY };
            }
        },
        []
    );

    const handleMouseMove = useCallback(
        (e) => {
            if (!isPanning) return;
            const deltaX = e.clientX - lastMousePos.current.x;
            const deltaY = e.clientY - lastMousePos.current.y;
            const newPan = { x: pan.x + deltaX, y: pan.y + deltaY };
            setPan(newPan);
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            persist(newPan, zoom);
        },
        [isPanning, pan, zoom, persist]
    );

    const handleMouseUp = useCallback(() => {
        setIsPanning(false);
    }, []);

    const setViewport = useCallback(
        (newPan, newZoom) => {
            if (newPan !== undefined) setPan(newPan);
            if (newZoom !== undefined) setZoom(newZoom);
            if (newPan !== undefined || newZoom !== undefined)
                persist(newPan !== undefined ? newPan : pan, newZoom !== undefined ? newZoom : zoom);
        },
        [pan, zoom, persist]
    );

    return {
        pan,
        zoom,
        isPanning,
        handleWheel,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        setViewport,
        transformStyle: {
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        },
    };
}
