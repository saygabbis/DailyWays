import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { Focus } from 'lucide-react';
import './SpaceView.css';

export default function SpaceView({ spaceId }) {
    const { state, dispatch, suppressRealtime } = useApp();
    const space = state.spaces.find(s => s.id === spaceId);

    const containerRef = useRef(null);
    const [pan, setPan] = useState({ x: space?.panX || 0, y: space?.panY || 0 });
    const [zoom, setZoom] = useState(space?.zoom || 1);
    const [isPanning, setIsPanning] = useState(false);

    const lastMousePos = useRef({ x: 0, y: 0 });
    const saveTimer = useRef(null);

    useEffect(() => {
        if (space) {
            setPan({ x: space.panX || 0, y: space.panY || 0 });
            setZoom(space.zoom || 1);
        }
    }, [spaceId]); // Reset on space change

    const persistCoordinates = useCallback((newPan, newZoom) => {
        if (saveTimer.current) clearTimeout(saveTimer.current);

        dispatch({
            type: 'UPDATE_SPACE',
            payload: { id: spaceId, updates: { panX: newPan.x, panY: newPan.y, zoom: newZoom } }
        });

        if (suppressRealtime) suppressRealtime(2000);

        saveTimer.current = setTimeout(async () => {
            try {
                const { updateSpace } = await import('../../services/workspaceService');
                await updateSpace(spaceId, { panX: newPan.x, panY: newPan.y, zoom: newZoom });
            } catch (error) {
                console.error('Failed to save space coords', error);
            }
        }, 1000);
    }, [spaceId, dispatch, suppressRealtime]);

    const handleWheel = (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
            const newZoom = Math.min(Math.max(0.1, zoom * zoomDelta), 5);
            setZoom(newZoom);
            persistCoordinates(pan, newZoom);
        } else {
            const newPan = {
                x: pan.x - e.deltaX,
                y: pan.y - e.deltaY
            };
            setPan(newPan);
            persistCoordinates(newPan, zoom);
        }
    };

    const handleMouseDown = (e) => {
        // Only middle click or left click on the empty space
        if (e.button === 1 || (e.button === 0 && e.target === containerRef.current)) {
            e.preventDefault();
            setIsPanning(true);
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        }
    };

    const handleMouseMove = (e) => {
        if (!isPanning) return;

        const deltaX = e.clientX - lastMousePos.current.x;
        const deltaY = e.clientY - lastMousePos.current.y;

        const newPan = {
            x: pan.x + deltaX,
            y: pan.y + deltaY
        };

        setPan(newPan);
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        persistCoordinates(newPan, zoom);
    };

    const handleMouseUp = () => {
        setIsPanning(false);
    };

    const handleReset = () => {
        setPan({ x: 0, y: 0 });
        setZoom(1);
        persistCoordinates({ x: 0, y: 0 }, 1);
    };

    if (!space) return <div className="space-view-empty">Space não encontrado</div>;

    const transformStyle = {
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    };

    // Calculate background position so the dots move with the pan
    // Background size is fixed (e.g. 20px) scaled by zoom.
    const bgSize = 24 * zoom;
    const bgPosX = pan.x % bgSize;
    const bgPosY = pan.y % bgSize;

    return (
        <div
            className={`space-view-container ${isPanning ? 'panning' : ''}`}
            ref={containerRef}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{
                backgroundSize: `${bgSize}px ${bgSize}px`,
                backgroundPosition: `${bgPosX}px ${bgPosY}px`
            }}
        >
            <div className="space-canvas" style={transformStyle}>
                {/* Canvas items will go here in the future */}
                <div className="space-center-marker">
                    {space.emoji} {space.title}
                </div>
            </div>

            <button className="space-reset-btn btn-floating" onClick={handleReset} title="Centralizar">
                <Focus size={18} />
            </button>
        </div>
    );
}
