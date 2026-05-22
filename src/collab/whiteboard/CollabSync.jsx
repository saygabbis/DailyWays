import { useEffect, useRef } from 'react';
import { SERVER_EVENTS } from '@dailyways/collab-protocol';
import { useWhiteboardStore } from '../stores/whiteboardStore';
import { usePresenceStore } from './presenceStore';
import { queuePresenceSync, flushPresenceSyncNow } from './queuePresenceSync.js';
import { useCollab } from './CollabContext.jsx';
import { joinSpaceRoom, leaveRoom } from './collabClient.js';
import { isCollabEnabled } from './collabConfig.js';
import { fetchNodes, fetchConnectors, fetchComments } from '../services/whiteboardService';

export default function CollabSync({ spaceId }) {
  const collab = useCollab();
  const joinedRef = useRef(null);

  useEffect(() => {
    if (!spaceId) return undefined;

    const hydrateFromFetch = async () => {
      const [nodesRes, connRes, commentsRes] = await Promise.all([
        fetchNodes(spaceId),
        fetchConnectors(spaceId),
        fetchComments(spaceId),
      ]);
      useWhiteboardStore.getState().hydrateRoom({
        nodes: nodesRes.data || [],
        connectors: connRes.data || [],
        comments: commentsRes.data || [],
        revision: 0,
      });
    };

    if (!isCollabEnabled() || !collab?.socket) {
      hydrateFromFetch();
      return undefined;
    }

    const socket = collab.socket;
    let cancelled = false;

    const onSocketDisconnect = () => {
      joinedRef.current = null;
    };
    const onSocketConnect = () => {
      if (!cancelled && socket.connected) {
        (async () => {
          try {
            const res = await joinSpaceRoom(socket, spaceId);
            if (cancelled) return;
            joinedRef.current = spaceId;
            if (res.peers) flushPresenceSyncNow(res.peers);
          } catch (err) {
            console.warn('[CollabSync] rejoin failed', err.message);
          }
        })();
      }
    };

    const onState = (payload) => {
      if (cancelled) return;
      useWhiteboardStore.getState().hydrateRoom({
        nodes: payload.nodes || [],
        connectors: payload.connectors || [],
        comments: payload.comments || [],
        revision: payload.revision ?? 0,
      });
      if (payload.peers) flushPresenceSyncNow(payload.peers);
    };

    const onPresenceSync = (payload) => {
      if (!cancelled && payload?.peers) queuePresenceSync(payload.peers);
    };

    socket.on(SERVER_EVENTS.STATE, onState);
    socket.on(SERVER_EVENTS.PRESENCE_SYNC, onPresenceSync);
    socket.on('disconnect', onSocketDisconnect);
    socket.on('connect', onSocketConnect);

    (async () => {
      try {
        if (joinedRef.current && joinedRef.current !== spaceId) {
          leaveRoom(socket);
        }
        const res = await joinSpaceRoom(socket, spaceId);
        if (cancelled) return;
        joinedRef.current = spaceId;
        useWhiteboardStore.getState().hydrateRoom({
          nodes: res.nodes || [],
          connectors: res.connectors || [],
          comments: res.comments || [],
          revision: res.revision ?? 0,
        });
        if (res.peers) flushPresenceSyncNow(res.peers);
      } catch (err) {
        console.warn('[CollabSync] join failed, falling back to fetch', err.message);
        if (!cancelled) await hydrateFromFetch();
      }
    })();

    return () => {
      cancelled = true;
      socket.off(SERVER_EVENTS.STATE, onState);
      socket.off(SERVER_EVENTS.PRESENCE_SYNC, onPresenceSync);
      socket.off('disconnect', onSocketDisconnect);
      socket.off('connect', onSocketConnect);
      if (joinedRef.current === spaceId) {
        leaveRoom(socket);
        joinedRef.current = null;
      }
    };
  }, [spaceId, collab?.socket]);

  return null;
}
