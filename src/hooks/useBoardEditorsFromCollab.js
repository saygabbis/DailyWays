import { useMemo } from 'react';
import { usePresenceStore } from '../collab/presenceStore';
import { useCollab } from '../collab/CollabContext.jsx';
import { initialFromName } from '../utils/userColor';

/**
 * Maps collab presence peers to editorsByCardId (replaces Supabase board-presence).
 */
export function useBoardEditorsFromCollab() {
  const peers = usePresenceStore((s) => s.peers);
  const collab = useCollab();
  const myId = collab?.userId;

  return useMemo(() => {
    const next = {};
    for (const peer of peers || []) {
      if (!peer?.selectedCardId || peer.userId === myId) continue;
      const cardId = peer.selectedCardId;
      if (!next[cardId]) next[cardId] = [];
      next[cardId].push({
        userId: peer.userId,
        name: peer.name || null,
        photoUrl: peer.photoUrl || null,
        avatarInitial: peer.avatarInitial || initialFromName(peer.name || peer.userId),
        color: peer.color,
      });
    }
    return next;
  }, [peers, myId]);
}
