import React, { useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { usePresenceStore } from './presenceStore';
import { useCollab } from './CollabContext.jsx';
import { presenceLabelTextColor } from '../utils/presenceLabelContrast.js';
import './PresenceLayer.css';

function toWorldScreen(cursor, panX, panY, zoom) {
  if (!cursor) return null;
  return { x: cursor.x * zoom + panX, y: cursor.y * zoom + panY };
}

/** Posição em coordenadas de viewport (evita clip por overflow do board-scroller / modal). */
function resolveViewportPosition(peer, remoteCursors, mode, panX, panY, zoom) {
  const remote = remoteCursors[peer.userId];
  const cur = remote ?? peer.cursor;
  if (mode === 'screen') {
    const cs = remote?.cursorScreen ?? peer.cursorScreen;
    if (cs && typeof cs.x === 'number' && typeof cs.y === 'number') {
      return { x: cs.x, y: cs.y };
    }
    if (cur && typeof cur.x === 'number' && typeof cur.y === 'number') {
      return { x: cur.x, y: cur.y };
    }
    return null;
  }
  return toWorldScreen(cur, panX, panY, zoom);
}

/**
 * Remote cursors: meta from peers (rare updates), positions from remoteCursors (per frame, isolated).
 */
export default function CollabPresenceLayer({
  mode = 'world',
  viewport,
  elevated = false,
  peerFilter,
}) {
  const peers = usePresenceStore((s) => s.peers);
  const cursorFrame = usePresenceStore((s) => s.cursorFrame);
  const collab = useCollab();
  const myId = collab?.userId;
  const layerRef = useRef(null);
  const nodeRefs = useRef(new Map());
  const viewportRef = useRef(viewport);

  viewportRef.current = viewport;
  const { panX = 0, panY = 0, zoom = 1 } = viewport || {};

  const visibleMeta = useMemo(() => {
    if (!collab?.connected || !peers?.length) return [];
    const out = peers
      .filter((p) => p.userId && p.userId !== myId)
      .filter((p) => (peerFilter ? peerFilter(p) : true));
    return out;
  }, [peers, myId, peerFilter, collab?.connected]);

  const applyPeerMetaToNode = (el, peer) => {
    const color = peer.color || '#7c3aed';
    const displayName = peer.name || peer.avatarInitial || 'Usuário';
    el.style.setProperty('--presence-color', color);
    const label = el.querySelector('.collab-presence-label');
    if (label) {
      label.textContent = displayName;
      label.style.background = color;
      label.style.color = presenceLabelTextColor(color);
    }
    const path = el.querySelector('.collab-presence-pointer path');
    if (path) path.setAttribute('fill', color);
  };

  const isNodeInLayer = (el, layer) => {
    if (!el || !layer) return false;
    return el.isConnected && layer.contains(el);
  };

  const createCursorNode = (peer) => {
    const color = peer.color || '#7c3aed';
    const el = document.createElement('div');
    el.className = 'collab-presence-cursor';
    el.dataset.userId = peer.userId;
    el.style.setProperty('--presence-color', color);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'collab-presence-pointer');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '24');
    svg.setAttribute('viewBox', '0 0 20 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M2 2 L2 17 L7 12 L10.5 21 L13 19.5 L9.5 11.5 L16 11.5 Z');
    path.setAttribute('fill', color);
    path.setAttribute('stroke', '#fff');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    el.appendChild(svg);
    const label = document.createElement('span');
    label.className = 'collab-presence-label';
    label.style.background = color;
    label.style.color = presenceLabelTextColor(color);
    label.textContent = peer.name || peer.avatarInitial || 'Usuário';
    el.appendChild(label);
    return el;
  };

  useEffect(() => () => {
    for (const el of nodeRefs.current.values()) {
      el.remove();
    }
    nodeRefs.current.clear();
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    const metaIds = new Set(visibleMeta.map((p) => p.userId));
    for (const id of [...nodeRefs.current.keys()]) {
      if (!metaIds.has(id)) {
        nodeRefs.current.get(id)?.remove();
        nodeRefs.current.delete(id);
      }
    }

    for (const peer of visibleMeta) {
      let el = nodeRefs.current.get(peer.userId);
      if (!isNodeInLayer(el, layer)) {
        if (el) {
          el.remove();
          nodeRefs.current.delete(peer.userId);
        }
        el = createCursorNode(peer);
        layer.appendChild(el);
        nodeRefs.current.set(peer.userId, el);
      } else if (!el) {
        el = createCursorNode(peer);
        layer.appendChild(el);
        nodeRefs.current.set(peer.userId, el);
      } else {
        applyPeerMetaToNode(el, peer);
      }
    }
  }, [visibleMeta]);

  useEffect(() => {
    const remoteCursors = usePresenceStore.getState().remoteCursors;
    const { panX: px = 0, panY: py = 0, zoom: z = 1 } = viewportRef.current || {};
    for (const peer of visibleMeta) {
      const el = nodeRefs.current.get(peer.userId);
      if (!el) continue;
      const screen = resolveViewportPosition(peer, remoteCursors, mode, px, py, z);
      if (!screen) {
        el.style.display = 'none';
        continue;
      }
      el.style.display = '';
      el.style.transform = `translate3d(${screen.x}px, ${screen.y}px, 0)`;
    }
  }, [cursorFrame, visibleMeta, peers, mode, panX, panY, zoom]);

  if (!collab?.connected || !visibleMeta.length) return null;

  const useViewportPortal = mode === 'screen';
  const layer = (
    <div
      ref={layerRef}
      className={[
        'collab-presence-layer',
        useViewportPortal ? 'collab-presence-layer--viewport' : 'collab-presence-layer--embedded',
        elevated ? 'collab-presence-layer--elevated' : '',
      ].filter(Boolean).join(' ')}
      aria-hidden
    />
  );

  if (useViewportPortal && typeof document !== 'undefined') {
    return createPortal(layer, document.body);
  }
  return layer;
}
