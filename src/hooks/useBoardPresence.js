import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { colorFromUserId, initialFromName } from '../utils/userColor';

function normalizePresenceState(presenceState) {
  // presenceState shape: { [key: string]: Array<PresencePayload> }
  return presenceState || {};
}

export function useBoardPresence(boardId) {
  const { user } = useAuth();
  const myId = user?.id;

  const [editorsByCardId, setEditorsByCardId] = useState({});

  const channelName = useMemo(() => {
    if (!boardId) return null;
    return `board-presence:${boardId}`;
  }, [boardId]);

  useEffect(() => {
    if (!channelName) return;
    // Presence channel needs a stable key; if user isn't ready, skip.
    if (!myId) return;

    const channel = supabase.channel(channelName, {
      config: { presence: { key: myId } },
    });

    const handleSync = () => {
      const ps = normalizePresenceState(channel.presenceState?.() || {});
      const next = {};

      for (const [key, presences] of Object.entries(ps)) {
        const arr = Array.isArray(presences) ? presences : [presences];
        const active = arr.find(p => p && p.cardId);
        if (!active) continue;

        const cardId = active.cardId;
        if (!next[cardId]) next[cardId] = [];

        const color = active.color || colorFromUserId(key);

        next[cardId].push({
          userId: key,
          name: active.name || null,
          photoUrl: active.photoUrl || null,
          avatarInitial: active.avatarInitial || initialFromName(active.name || key),
          color,
        });
      }

      setEditorsByCardId(next);
    };

    channel.on('presence', { event: 'sync' }, handleSync);

    const sub = channel.subscribe((status) => {
      // status: SUBSCRIBED, TIMED_OUT, CHANNEL_ERROR...
      // We keep this hook silent to avoid noise in logs.
      void status;
    });

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (_) { }
      void sub;
    };
  }, [channelName, myId]);

  return { editorsByCardId };
}

