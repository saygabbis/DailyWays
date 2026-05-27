import React, { useMemo } from 'react';
import { useCollab } from '../../core/CollabContext.jsx';
import { usePresenceStore } from '../../board/presence/presenceStore.js';
import './SpaceRemoteDragLayer.css';

function toScreenRect(rect, viewport, layerRect = null) {
  if (!rect || typeof rect.x !== 'number' || typeof rect.y !== 'number') return null;
  const zoom = viewport?.zoom ?? 1;
  const panX = viewport?.panX ?? 0;
  const panY = viewport?.panY ?? 0;
  const centerX = layerRect ? layerRect.width / 2 : 0;
  const centerY = layerRect ? layerRect.height / 2 : 0;
  const width = Math.max(1, (rect.width ?? 0) * zoom);
  const height = Math.max(1, (rect.height ?? 0) * zoom);
  return {
    left: centerX + rect.x * zoom + panX,
    top: centerY + rect.y * zoom + panY,
    width,
    height,
    borderRadius: resolveBorderRadius(rect, zoom),
  };
}

function resolveBorderRadius(rect, zoom) {
  if (rect?.radiusShape === 'ellipse') return '50%';
  if (rect?.cornerRadii && typeof rect.cornerRadii === 'object') {
    const { tl = 0, tr = 0, br = 0, bl = 0 } = rect.cornerRadii;
    return `${Math.max(0, tl * zoom)}px ${Math.max(0, tr * zoom)}px ${Math.max(0, br * zoom)}px ${Math.max(0, bl * zoom)}px`;
  }
  if (typeof rect?.borderRadius === 'number') {
    return `${Math.max(0, rect.borderRadius * zoom)}px`;
  }
  return '0px';
}

export default function SpaceRemoteDragLayer({ viewport, worldContainerRef = null }) {
  const collab = useCollab();
  const peers = usePresenceStore((s) => s.peers);
  const myId = collab?.userId;

  const dragGhosts = useMemo(() => {
    if (!collab?.connected || !Array.isArray(peers) || peers.length === 0) return [];
    const layerRect = worldContainerRef?.current?.getBoundingClientRect?.() ?? null;
    const out = [];
    for (const peer of peers) {
      if (!peer?.userId || peer.userId === myId) continue;
      const ids = Array.isArray(peer.draggingNodeIds) ? peer.draggingNodeIds : [];
      const rects = Array.isArray(peer.dragPreviewRects) ? peer.dragPreviewRects : [];
      if (ids.length === 0 || rects.length === 0) continue;
      const color = peer.color || '#7c3aed';
      for (let i = 0; i < rects.length; i += 1) {
        const rect = toScreenRect(rects[i], viewport, layerRect);
        if (!rect) continue;
        out.push({
          key: `${peer.userId}-${i}-${ids[i] || 'node'}`,
          color,
          ...rect,
        });
      }
    }
    return out;
  }, [collab?.connected, myId, peers, viewport?.panX, viewport?.panY, viewport?.zoom, worldContainerRef]);

  if (!collab?.connected || dragGhosts.length === 0) return null;

  return (
    <div className="space-remote-drag-layer" aria-hidden>
      {dragGhosts.map((ghost) => (
        <div
          key={ghost.key}
          className="space-remote-drag-ghost"
          style={{
            left: `${ghost.left}px`,
            top: `${ghost.top}px`,
            width: `${ghost.width}px`,
            height: `${ghost.height}px`,
            borderRadius: ghost.borderRadius,
            borderColor: ghost.color,
            boxShadow: `0 0 0 1px ${ghost.color}44`,
          }}
        />
      ))}
    </div>
  );
}
