import { useMemo } from 'react';
import { usePresenceStore } from '../collab/board/presence/presenceStore';
import { useCollab } from '../collab/core/CollabContext.jsx';
import { initialFromName } from '../utils/userColor';

export function useBoardRemoteSelection() {
    const peers = usePresenceStore((s) => s.peers);
    const collab = useCollab();
    const myId = collab?.userId;

    return useMemo(() => {
        const remoteSelectionByCardId = {};
        for (const peer of peers || []) {
            if (!peer?.userId || peer.userId === myId) continue;
            const ids = peer.selectedCardIds;
            if (!Array.isArray(ids) || !ids.length) continue;
            const meta = {
                userId: peer.userId,
                name: peer.name || null,
                color: peer.color || '#7c3aed',
                avatarInitial: peer.avatarInitial || initialFromName(peer.name || peer.userId),
            };
            for (const cardId of ids) {
                if (!remoteSelectionByCardId[cardId]) remoteSelectionByCardId[cardId] = [];
                remoteSelectionByCardId[cardId].push(meta);
            }
        }
        return { remoteSelectionByCardId };
    }, [peers, myId]);
}
