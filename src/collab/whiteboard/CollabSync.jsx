import { useEffect, useRef } from 'react';
import { SERVER_EVENTS } from '@dailyways/collab-protocol';
import { useWhiteboardStore } from '../../stores/whiteboardStore';
import { queuePresenceSync, flushPresenceSyncNow } from '../board/presence/queuePresenceSync.js';
import { useCollab } from '../core/CollabContext.jsx';
import { joinSpaceRoom, leaveRoom } from '../core/collabClient.js';
import { isCollabEnabled } from '../core/collabConfig.js';
import { fetchNodes, fetchConnectors, fetchComments } from '../../services/whiteboardService';

export default function CollabSync({ spaceId }) {
  const collab = useCollab();
  const joinedRef = useRef(null);
  const joinGenRef = useRef(0);
  const effectGenRef = useRef(0);

  useEffect(() => {
    if (!spaceId) return undefined;

    const gen = ++effectGenRef.current;
    let cancelled = false;

    const hydrateFromFetch = async () => {
      const [nodesRes, connRes, commentsRes] = await Promise.all([
        fetchNodes(spaceId),
        fetchConnectors(spaceId),
        fetchComments(spaceId),
      ]);
      if (cancelled || effectGenRef.current !== gen) return;
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

    const performJoin = async () => {
      const joinGen = ++joinGenRef.current;
      try {
        if (joinedRef.current && joinedRef.current !== spaceId) {
          await leaveRoom(socket);
        }
        const res = await joinSpaceRoom(socket, spaceId);
        if (cancelled || effectGenRef.current !== gen || joinGenRef.current !== joinGen) return;
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
        if (!cancelled && effectGenRef.current === gen) await hydrateFromFetch();
      }
    };

    const onSocketDisconnect = () => {
      joinedRef.current = null;
    };

    const onSocketConnect = () => {
      if (!cancelled && socket.connected) performJoin();
    };

    const onState = (payload) => {
      if (cancelled || effectGenRef.current !== gen) return;
      useWhiteboardStore.getState().hydrateRoom({
        nodes: payload.nodes || [],
        connectors: payload.connectors || [],
        comments: payload.comments || [],
        revision: payload.revision ?? 0,
      });
      if (payload.peers) flushPresenceSyncNow(payload.peers);
    };

    const onPresenceSync = (payload) => {
      if (!cancelled && effectGenRef.current === gen && payload?.peers) {
        queuePresenceSync(payload.peers);
      }
    };

    const onReconnected = () => {
      if (!cancelled && socket.connected) performJoin();
    };

    socket.on(SERVER_EVENTS.STATE, onState);
    socket.on(SERVER_EVENTS.PRESENCE_SYNC, onPresenceSync);
    socket.on('disconnect', onSocketDisconnect);
    socket.on('connect', onSocketConnect);
    window.addEventListener('collab-socket-reconnected', onReconnected);

    performJoin();

    return () => {
      cancelled = true;
      socket.off(SERVER_EVENTS.STATE, onState);
      socket.off(SERVER_EVENTS.PRESENCE_SYNC, onPresenceSync);
      socket.off('disconnect', onSocketDisconnect);
      socket.off('connect', onSocketConnect);
      window.removeEventListener('collab-socket-reconnected', onReconnected);
      if (joinedRef.current === spaceId) {
        leaveRoom(socket).finally(() => {
          joinedRef.current = null;
        });
      }
    };
  }, [spaceId, collab?.socket]);

  return null;
}
