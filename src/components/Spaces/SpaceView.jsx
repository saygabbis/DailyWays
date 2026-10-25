import { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/useApp';
import { useWhiteboardSelectionStore } from '../../stores/whiteboardSelectionStore';
import { getInspectorInsetPx, CanvasEngine } from '../Whiteboard';
import { SpaceCollabOpsProvider } from '../../collab/space/ops/SpaceCollabOpsContext.jsx';
import SpaceCollabSync from '../../collab/space/sync/SpaceCollabSync.jsx';
import SpaceCollabStatusBanner from '../../collab/space/ui/SpaceCollabStatusBanner.jsx';
import PresenceOnlineList from '../../collab/board/ui/PresenceOnlineList.jsx';
import './SpaceView.css';

const VIEW_KEY = (spaceId) => `dailyways_space_view_${spaceId}`;

/** Câmera do canvas é de cada aparelho (antes ia para a linha do space, compartilhada por todos). */
function loadLocalView(spaceId) {
    try {
        const v = JSON.parse(localStorage.getItem(VIEW_KEY(spaceId)) || 'null');
        if (v && Number.isFinite(v.panX) && Number.isFinite(v.panY) && Number.isFinite(v.zoom) && v.zoom > 0) return v;
    } catch { /* sem storage: abre enquadrando o conteúdo */ }
    return null;
}

export default function SpaceView({ spaceId }) {
    const { state } = useApp();
    const inspectorPanelOpen = useWhiteboardSelectionStore((s) => s.inspectorPanelOpen);
    const inspectorInset = getInspectorInsetPx(inspectorPanelOpen);
    const storedSpace = state.spaces.find(s => s.id === spaceId);
    const saveTimer = useRef(null);
    // Sem vista salva neste aparelho → 0,0 a 100%: o canvas enquadra o conteúdo ao abrir.
    const [initialView] = useState(() => loadLocalView(spaceId) || { panX: 0, panY: 0, zoom: 1 });
    const space = useMemo(
        () => (storedSpace ? { ...storedSpace, ...initialView } : null),
        [storedSpace, initialView],
    );

    useEffect(() => () => clearTimeout(saveTimer.current), []);

    const onViewportChange = useCallback((newPan, newZoom) => {
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            try {
                localStorage.setItem(VIEW_KEY(spaceId), JSON.stringify({ panX: newPan.x, panY: newPan.y, zoom: newZoom }));
            } catch { /* storage cheio ou bloqueado: só não lembra a vista */ }
        }, 400);
    }, [spaceId]);

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
            <SpaceCollabOpsProvider>
                <SpaceCollabSync spaceId={spaceId} />
                <SpaceCollabStatusBanner />
                <div className="space-presence-bar">
                    <PresenceOnlineList />
                </div>
                <CanvasEngine
                    spaceId={spaceId}
                    space={space}
                    onViewportChange={onViewportChange}
                />
            </SpaceCollabOpsProvider>
        </div>
    );
}
