import React, { useRef, useState, useCallback, useEffect } from 'react';
import { zoomViewportAtClient } from './viewportUtils';

/**
 * Handles pan and zoom for the canvas (Miro-style).
 * Wheel = zoom toward cursor. Space + drag = pan. Middle mouse + drag = pan.
 */
export function useViewport(initialPan = { x: 0, y: 0 }, initialZoom = 1, onViewportChange, containerRef) {
    const [pan, setPan] = useState(initialPan);
    const [zoom, setZoom] = useState(initialZoom);
    const [isPanning, setIsPanning] = useState(false);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const panRef = useRef(initialPan);
    const zoomRef = useRef(initialZoom);

    panRef.current = pan;
    zoomRef.current = zoom;

    const persist = useCallback(
        (newPan, newZoom) => {
            if (onViewportChange) onViewportChange(newPan, newZoom);
        },
        [onViewportChange]
    );

    const applyWheelZoom = useCallback(
        (clientX, clientY, deltaY) => {
            const zoomFactor = deltaY > 0 ? 0.9 : 1.1;
            const rect = containerRef?.current?.getBoundingClientRect?.() ?? null;
            const { pan: newPan, zoom: newZoom } = zoomViewportAtClient(
                panRef.current,
                zoomRef.current,
                clientX,
                clientY,
                rect,
                zoomFactor
            );
            setPan(newPan);
            setZoom(newZoom);
            persist(newPan, newZoom);
        },
        [persist, containerRef]
    );

    const handleWheel = useCallback(
        (e) => {
            e.preventDefault();
            e.stopPropagation();
            applyWheelZoom(e.clientX, e.clientY, e.deltaY);
        },
        [applyWheelZoom]
    );

    /** Bloqueia zoom do navegador (Ctrl+scroll) enquanto o cursor está no canvas. */
    useEffect(() => {
        const el = containerRef?.current;
        if (!el) return undefined;
        const onWheelCapture = (e) => {
            if (!e.ctrlKey) return;
            e.preventDefault();
            e.stopPropagation();
            applyWheelZoom(e.clientX, e.clientY, e.deltaY);
        };
        el.addEventListener('wheel', onWheelCapture, { passive: false, capture: true });
        return () => el.removeEventListener('wheel', onWheelCapture, { capture: true });
    }, [containerRef, applyWheelZoom]);

    const zoomAtClient = useCallback(
        (clientX, clientY, zoomFactor) => {
            const rect = containerRef?.current?.getBoundingClientRect?.() ?? null;
            const { pan: newPan, zoom: newZoom } = zoomViewportAtClient(
                pan,
                zoom,
                clientX,
                clientY,
                rect,
                zoomFactor
            );
            setPan(newPan);
            setZoom(newZoom);
            persist(newPan, newZoom);
        },
        [pan, zoom, persist, containerRef]
    );

    const handleMouseDown = useCallback(
        (e, isSpacePressed) => {
            const startPan = e.button === 1 || (e.button === 0 && isSpacePressed);
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
            const newPan = {
                x: panRef.current.x + deltaX,
                y: panRef.current.y + deltaY,
            };
            setPan(newPan);
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            persist(newPan, zoomRef.current);
        },
        [isPanning, persist]
    );

    const handleMouseUp = useCallback(() => {
        setIsPanning(false);
    }, []);

    const setViewport = useCallback(
        (newPan, newZoom) => {
            const nextPan = newPan !== undefined ? newPan : panRef.current;
            const nextZoom = newZoom !== undefined ? newZoom : zoomRef.current;
            if (newPan !== undefined) setPan(nextPan);
            if (newZoom !== undefined) setZoom(nextZoom);
            if (newPan !== undefined || newZoom !== undefined) persist(nextPan, nextZoom);
        },
        [persist]
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
        zoomAtClient,
        transformStyle: {
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        },
    };
}
