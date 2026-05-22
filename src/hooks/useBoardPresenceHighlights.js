import { useMemo } from 'react';
import { usePresenceStore } from '../collab/board/presence/presenceStore';
import { useCollab } from '../collab/core/CollabContext.jsx';
import { isPeerOnBoardSurface } from '../collab/board/presence/presenceVisibility.js';
import { initialFromName } from '../utils/userColor';

/**
 * Remote hover / drag highlights from collab presence peers.
 */
function cursorKey(c) {
  if (!c || typeof c.x !== 'number' || typeof c.y !== 'number') return '';
  return `${c.x},${c.y}`;
}

function draggingCursorSig(state) {
  const parts = [];
  for (const p of state.peers || []) {
    if (!p.draggingCardId && !p.draggingListId) continue;
    const c = state.remoteCursors[p.userId];
    parts.push(
      `${p.userId}:${p.draggingCardId || ''}:${p.draggingListId || ''}:`
      + `${cursorKey(c)}:${cursorKey(p.cursorScreen)}`,
    );
  }
  return parts.sort().join('|');
}

/** Posição de arrasto no conteúdo do board (não viewport). */
function dragPosition(peer) {
  const c = peer.cursor;
  if (c && typeof c.x === 'number' && typeof c.y === 'number') {
    return { x: c.x, y: c.y };
  }
  return { x: null, y: null };
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
    const remoteListDrags = [];

    for (const peer of peers || []) {
      if (!peer?.userId || peer.userId === myId) continue;
      const dragging = Boolean(peer.draggingCardId || peer.draggingListId);
      if (!dragging && !isPeerOnBoardSurface(peer)) continue;
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
        const { x, y } = dragPosition(peer);
        remoteDrags.push({
          ...meta,
          cardId: peer.draggingCardId,
          listId: peer.draggingListId || null,
          x,
          y,
        });
      } else if (peer.draggingListId) {
        const { x, y } = dragPosition(peer);
        remoteListDrags.push({
          ...meta,
          listId: peer.draggingListId,
          x,
          y,
        });
      }
    }

    return { hoverByCardId, hoverByListId, remoteDrags, remoteListDrags };
  }, [peers, dragCursors, myId]);
}
