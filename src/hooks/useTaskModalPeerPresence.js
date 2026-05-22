import { useMemo } from 'react';
import { usePresenceStore } from '../collab/board/presence/presenceStore';
import { useCollab } from '../collab/core/CollabContext.jsx';
import { initialFromName } from '../utils/userColor';

/** Hover + rascunho ao vivo de peers na mesma task/modal. */
export function useTaskModalPeerPresence(cardId) {
  const peers = usePresenceStore((s) => s.peers);
  const collab = useCollab();
  const myId = collab?.userId;

  return useMemo(() => {
    const hoverByEl = {};
    const liveDrafts = [];

    for (const peer of peers || []) {
      if (!peer?.userId || peer.userId === myId || peer.selectedCardId !== cardId) continue;
      const color = peer.color || '#7c3aed';
      const meta = {
        userId: peer.userId,
        name: peer.name || null,
        color,
        avatarInitial: peer.avatarInitial || initialFromName(peer.name || peer.userId),
      };
      if (peer.hoverModalEl) {
        if (!hoverByEl[peer.hoverModalEl]) hoverByEl[peer.hoverModalEl] = [];
        hoverByEl[peer.hoverModalEl].push(meta);
      }
      if (peer.liveDraft && (peer.liveDraft.title != null || peer.liveDraft.description != null)) {
        liveDrafts.push({ ...meta, draft: peer.liveDraft });
      }
    }

    return { hoverByEl, liveDrafts };
  }, [peers, cardId, myId]);
}

export function presenceHoverClass(hoverByEl, key, baseClass = '') {
  const on = hoverByEl?.[key]?.length;
  return [baseClass, on ? 'presence-remote-hover-target' : ''].filter(Boolean).join(' ');
}

export function presenceHoverStyle(hoverByEl, key, baseStyle = {}) {
  const peer = hoverByEl?.[key]?.[0];
  if (!peer) return baseStyle;
  return { ...baseStyle, '--presence-color': peer.color };
}
