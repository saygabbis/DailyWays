import { useMemo } from 'react';
import { usePresenceStore } from '../collab/presenceStore';
import { useCollab } from '../collab/CollabContext.jsx';
import { initialFromName } from '../utils/userColor';

/**
 * Remote hover / drag highlights from collab presence peers.
 */
function draggingCursorSig(state) {
  const parts = [];
  for (const p of state.peers || []) {
    if (!p.draggingCardId) continue;
    const c = state.remoteCursors[p.userId];
    parts.push(`${p.userId}:${c?.x ?? ''},${c?.y ?? ''}`);
  }
  return parts.sort().join('|');
}

export function useBoardPresenceHighlights() {
  const peers = usePresenceStore((s) => s.peers);
  const dragCursors = usePresenceStore(draggingCursorSig);
  const collab = useCollab();
  const myId = collab?.userId;

  return useMemo(() => {
    const remoteCursors = usePresenceStore.getState().remoteCursors;
    const hoverByCardId = {};
    const hoverByListId = {};
    const remoteDrags = [];

    for (const peer of peers || []) {
      if (!peer?.userId || peer.userId === myId) continue;
      const color = peer.color || '#7c3aed';
      const meta = {
        userId: peer.userId,
        name: peer.name || null,
        color,
        avatarInitial: peer.avatarInitial || initialFromName(peer.name || peer.userId),
      };

      if (peer.hoverCardId) {
        if (!hoverByCardId[peer.hoverCardId]) hoverByCardId[peer.hoverCardId] = [];
        hoverByCardId[peer.hoverCardId].push(meta);
      }
      if (peer.hoverListId) {
        if (!hoverByListId[peer.hoverListId]) hoverByListId[peer.hoverListId] = [];
        hoverByListId[peer.hoverListId].push(meta);
      }
      if (peer.draggingCardId) {
        const c = remoteCursors[peer.userId] || peer.cursor || peer.cursorScreen;
        remoteDrags.push({
          ...meta,
          cardId: peer.draggingCardId,
          listId: peer.draggingListId || null,
          x: typeof c?.x === 'number' ? c.x : null,
          y: typeof c?.y === 'number' ? c.y : null,
        });
      }
    }

    return { hoverByCardId, hoverByListId, remoteDrags };
  }, [peers, dragCursors, myId]);
}
