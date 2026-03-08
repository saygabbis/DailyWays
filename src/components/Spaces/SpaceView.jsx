import React, { useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { Focus } from 'lucide-react';
import CanvasEngine from '../Whiteboard/CanvasEngine';
import './SpaceView.css';

export default function SpaceView({ spaceId }) {
    const { state, dispatch, suppressRealtime } = useApp();
    const space = state.spaces.find(s => s.id === spaceId);
    const saveTimer = useRef(null);

    const onViewportChange = useCallback((newPan, newZoom) => {
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

    const handleReset = useCallback(async () => {
        dispatch({
            type: 'UPDATE_SPACE',
            payload: { id: spaceId, updates: { panX: 0, panY: 0, zoom: 1 } }
        });
        if (suppressRealtime) suppressRealtime(2000);
        try {
            const { updateSpace } = await import('../../services/workspaceService');
            await updateSpace(spaceId, { panX: 0, panY: 0, zoom: 1 });
        } catch (error) {
            console.error('Failed to reset space coords', error);
        }
    }, [spaceId, dispatch, suppressRealtime]);

    if (!space) return <div className="space-view-empty">Space não encontrado</div>;

    return (
        <div className="space-view-container" style={{ position: 'relative', width: '100%', height: '100%' }}>
            <CanvasEngine spaceId={spaceId} space={space} onViewportChange={onViewportChange} />
            <button className="space-reset-btn btn-floating" onClick={handleReset} title="Centralizar">
                <Focus size={18} />
            </button>
        </div>
    );
}
