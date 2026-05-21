import React, { useEffect, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useBoardPresenceHighlights } from '../hooks/useBoardPresenceHighlights';
import { usePresenceStore } from './presenceStore';
import './PresenceLayer.css';

/**
 * Ghost cards that follow remote peers while they drag (Figma-style).
 */
export default function RemoteDragLayer({ boardId }) {
  const { state } = useApp();
  const { remoteDrags } = useBoardPresenceHighlights();
  const cursorFrame = usePresenceStore((s) => s.cursorFrame);
  const layerRef = useRef(null);
  const nodeRefs = useRef(new Map());

  const cardsById = useMemo(() => {
    const board = state.boards.find((b) => b.id === boardId);
    if (!board) return {};
    const map = {};
    for (const list of board.lists) {
      for (const card of list.cards) {
        map[card.id] = card;
      }
    }
    return map;
  }, [state.boards, boardId]);

  const dragKey = useMemo(
    () => remoteDrags.map((d) => `${d.userId}:${d.cardId}`).join('|'),
    [remoteDrags],
  );

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    const active = new Set(remoteDrags.map((d) => `${d.userId}-${d.cardId}`));
    for (const key of [...nodeRefs.current.keys()]) {
      if (!active.has(key)) {
        nodeRefs.current.get(key)?.remove();
        nodeRefs.current.delete(key);
      }
    }

    for (const drag of remoteDrags) {
      const key = `${drag.userId}-${drag.cardId}`;
      if (nodeRefs.current.has(key)) continue;
      const card = cardsById[drag.cardId];
      if (!card) continue;

      const color = drag.color || '#7c3aed';
      const el = document.createElement('div');
      el.className = 'collab-remote-drag-ghost';
      el.dataset.dragKey = key;

      const inner = document.createElement('div');
      inner.className = 'collab-remote-drag-ghost-inner animate-slide-up-jelly';

      const title = document.createElement('span');
      title.className = 'collab-remote-drag-ghost-title';
      title.textContent = card.title;

      const label = document.createElement('span');
      label.className = 'collab-remote-drag-ghost-label';
      label.style.background = color;
      label.textContent = drag.name || drag.avatarInitial || 'Usuário';

      inner.appendChild(title);
      inner.appendChild(label);
      el.appendChild(inner);
      el.style.setProperty('--presence-color', color);
      layer.appendChild(el);
      nodeRefs.current.set(key, el);
    }
  }, [dragKey, remoteDrags, cardsById]);

  useEffect(() => {
    const cursors = usePresenceStore.getState().remoteCursors;
    for (const drag of remoteDrags) {
      const key = `${drag.userId}-${drag.cardId}`;
      const el = nodeRefs.current.get(key);
      if (!el) continue;
      const label = el.querySelector('.collab-remote-drag-ghost-label');
      if (label) {
        const color = drag.color || '#7c3aed';
        label.textContent = drag.name || drag.avatarInitial || 'Usuário';
        label.style.background = color;
        el.style.setProperty('--presence-color', color);
      }
      const cur = cursors[drag.userId];
      const x = typeof cur?.x === 'number' ? cur.x : drag.x;
      const y = typeof cur?.y === 'number' ? cur.y : drag.y;
      if (x == null || y == null) {
        el.style.display = 'none';
        continue;
      }
      el.style.display = '';
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
  }, [cursorFrame, remoteDrags]);

  if (!remoteDrags.length) return null;

  return (
    <div ref={layerRef} className="collab-remote-drag-layer" aria-hidden />
  );
}
