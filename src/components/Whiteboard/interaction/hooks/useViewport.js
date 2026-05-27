import React, { useRef, useState, useCallback, useEffect } from 'react';
import { zoomViewportAtClient } from '../viewport/viewportUtils';

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
    const wheelFrameRef = useRef(null);
    const wheelDeltaRef = useRef(0);
    const wheelClientRef = useRef({ x: 0, y: 0 });
    const panFrameRef = useRef(null);
    const panDeltaRef = useRef({ dx: 0, dy: 0 });

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
            const zoomFactor = Math.exp(-deltaY * 0.0015);
            const rect = containerRef?.current?.getBoundingClientRect?.() ?? null;
            const { pan: newPan, zoom: newZoom } = zoomViewportAtClient(
                panRef.current,
                zoomRef.current,
                clientX,
                clientY,
                rect,
                zoomFactor
            );
            if (
                newZoom === zoomRef.current &&
                newPan.x === panRef.current.x &&
                newPan.y === panRef.current.y
            ) {
                return;
            }
            setPan(newPan);
            setZoom(newZoom);
            persist(newPan, newZoom);
        },
        [persist, containerRef]
    );

    const flushWheelZoom = useCallback(() => {
        wheelFrameRef.current = null;
        const deltaY = wheelDeltaRef.current;
        if (!deltaY) return;
        wheelDeltaRef.current = 0;
        applyWheelZoom(wheelClientRef.current.x, wheelClientRef.current.y, deltaY);
    }, [applyWheelZoom]);

    const scheduleWheelZoom = useCallback(
        (clientX, clientY, deltaY) => {
            wheelClientRef.current = { x: clientX, y: clientY };
            wheelDeltaRef.current += deltaY;
            if (wheelFrameRef.current) return;
            wheelFrameRef.current = requestAnimationFrame(flushWheelZoom);
        },
        [flushWheelZoom]
    );

    const handleWheel = useCallback(
        (e) => {
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
            scheduleWheelZoom(e.clientX, e.clientY, e.deltaY);
        },
        [scheduleWheelZoom]
    );

    /** Bloqueia zoom do navegador (Ctrl+scroll) enquanto o cursor está no canvas. */
    useEffect(() => {
        const el = containerRef?.current;
        if (!el) return undefined;
        const onWheelCapture = (e) => {
            if (!e.ctrlKey) return;
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
            scheduleWheelZoom(e.clientX, e.clientY, e.deltaY);
        };
        el.addEventListener('wheel', onWheelCapture, { passive: false, capture: true });
        return () => el.removeEventListener('wheel', onWheelCapture, { capture: true });
    }, [containerRef, scheduleWheelZoom]);

    useEffect(() => () => {
        if (wheelFrameRef.current) cancelAnimationFrame(wheelFrameRef.current);
        if (panFrameRef.current) cancelAnimationFrame(panFrameRef.current);
    }, []);

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
            const startPan = e.button === 1 || e.button === 2 || (e.button === 0 && isSpacePressed);
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
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            panDeltaRef.current.dx += deltaX;
            panDeltaRef.current.dy += deltaY;
            if (panFrameRef.current) return;
            panFrameRef.current = requestAnimationFrame(() => {
                panFrameRef.current = null;
                const { dx, dy } = panDeltaRef.current;
                panDeltaRef.current = { dx: 0, dy: 0 };
                if (!dx && !dy) return;
                const newPan = {
                    x: panRef.current.x + dx,
                    y: panRef.current.y + dy,
                };
                setPan(newPan);
                persist(newPan, zoomRef.current);
            });
        },
        [isPanning, persist]
    );

    const handleMouseUp = useCallback(() => {
        if (panFrameRef.current) {
            cancelAnimationFrame(panFrameRef.current);
            panFrameRef.current = null;
        }
        const { dx, dy } = panDeltaRef.current;
        panDeltaRef.current = { dx: 0, dy: 0 };
        if (dx || dy) {
            const newPan = {
                x: panRef.current.x + dx,
                y: panRef.current.y + dy,
            };
            setPan(newPan);
            persist(newPan, zoomRef.current);
        }
        setIsPanning(false);
    }, [persist]);

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
