import React from 'react';
import { useCollab } from '../../core/CollabContext.jsx';
import { useWhiteboardDocumentStore } from '../../../stores/whiteboardDocumentStore';
import './WhiteboardCollabStatusBanner.css';

export default function WhiteboardCollabStatusBanner() {
    const collab = useCollab();
    const pendingCount = useWhiteboardDocumentStore(
        (s) => Object.keys(s.pendingOps || {}).length
    );

    if (!collab?.enabled) return null;

    const reconnecting = collab.socket && !collab.connected;
    if (!reconnecting && pendingCount === 0) return null;

    return (
        <div className="whiteboard-collab-banner" role="status">
            {reconnecting && <span>A reconectar ao espaço…</span>}
            {!reconnecting && pendingCount > 0 && (
                <span>{pendingCount} alteração(ões) pendente(s)</span>
            )}
        </div>
    );
}
