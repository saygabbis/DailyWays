import React from 'react';
import { usePresenceStore } from '../presence/presenceStore';
import { useCollab } from '../../core/CollabContext.jsx';
import { initialFromName } from '../../../utils/userColor';
import './PresenceLayer.css';

function displayName(peer) {
  return peer.name || peer.avatarInitial || 'Usuário';
}

export default function PresenceOnlineList() {
  const peers = usePresenceStore((s) => s.peers);
  const collab = useCollab();
  const myId = collab?.userId;

  const others = (peers || []).filter((p) => p.userId && p.userId !== myId);
  if (!others.length || !collab?.connected) return null;

  return (
    <div className="collab-presence-online-list" title="Online agora">
      {others.map((peer) => {
        const color = peer.color || '#7c3aed';
        const label = displayName(peer);
        const initial = peer.avatarInitial || initialFromName(label);
        return (
          <div
            key={peer.userId}
            className="collab-presence-online-avatar"
            style={{ '--presence-color': color }}
            title={label}
          >
            {peer.photoUrl ? (
              <img src={peer.photoUrl} alt="" />
            ) : (
              <span className="collab-presence-online-initial">{initial}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
