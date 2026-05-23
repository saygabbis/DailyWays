import React, { useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useWhiteboardStore } from '../../stores/whiteboardStore';
import { getInspectorInsetPx } from '../Whiteboard/inspectorLayout';
import CanvasEngine from '../Whiteboard/CanvasEngine';
import { CollabOpsProvider } from '../../collab/whiteboard/CollabOpsContext.jsx';
import PresenceOnlineList from '../../collab/board/ui/PresenceOnlineList.jsx';
import './SpaceView.css';

export default function SpaceView({ spaceId }) {
    const { state, dispatch, suppressRealtime } = useApp();
    const inspectorPanelOpen = useWhiteboardStore((s) => s.inspectorPanelOpen);
    const inspectorInset = getInspectorInsetPx(inspectorPanelOpen);
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

    if (!space) return <div className="space-view-empty">Space não encontrado</div>;

    return (
        <div
            className="space-view-container"
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                '--inspector-inset': `${inspectorInset}px`,
            }}
        >
            <CollabOpsProvider>
                <div className="space-presence-bar">
                    <PresenceOnlineList />
                </div>
                <CanvasEngine
                    spaceId={spaceId}
                    space={space}
                    onViewportChange={onViewportChange}
                />
            </CollabOpsProvider>
        </div>
    );
}
