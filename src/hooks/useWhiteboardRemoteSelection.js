import { useMemo } from 'react';
import { usePresenceStore } from '../collab/board/presence/presenceStore';
import { useCollab } from '../collab/core/CollabContext.jsx';
import { initialFromName } from '../utils/userColor';

export function useWhiteboardRemoteSelection() {
    const peers = usePresenceStore((s) => s.peers);
    const collab = useCollab();
    const myId = collab?.userId;

    return useMemo(() => {
        const remoteSelectionByNodeId = {};
        for (const peer of peers || []) {
            if (!peer?.userId || peer.userId === myId) continue;
            const ids = peer.selectedNodeIds;
            if (!Array.isArray(ids) || !ids.length) continue;
            const meta = {
                userId: peer.userId,
                name: peer.name || null,
                color: peer.color || '#7c3aed',
                avatarInitial: peer.avatarInitial || initialFromName(peer.name || peer.userId),
            };
            for (const nodeId of ids) {
                if (!remoteSelectionByNodeId[nodeId]) remoteSelectionByNodeId[nodeId] = [];
                remoteSelectionByNodeId[nodeId].push(meta);
            }
        }
        return { remoteSelectionByNodeId };
    }, [peers, myId]);
}
