import { useEffect, useRef } from 'react';
import { SERVER_EVENTS } from '@dailyways/collab-protocol';
import { useWhiteboardDocumentStore } from '../../../stores/whiteboardDocumentStore';
import { queuePresenceSync, flushPresenceSyncNow } from '../../shared/presence/queuePresenceSync.js';
import { useCollab } from '../../core/CollabContext.jsx';
import { joinSpaceRoom, leaveRoom } from '../../core/collabClient.js';
import { isCollabEnabled } from '../../core/collabConfig.js';
import {
    fetchNodes,
    fetchConnectors,
    fetchComments,
    fetchRulerGuides,
} from '../../../services/whiteboardService';
import { isStaleSpaceSnapshot } from './spaceFingerprint.js';
import {
  getGlobalJoinedSpaceId,
  setGlobalJoinedSpaceId,
  clearGlobalJoinedSpaceId,
  nextSpaceCollabMountGen,
  getSpaceCollabMountGen,
} from './spaceCollabSession.js';

export default function SpaceCollabSync({ spaceId }) {
  const collab = useCollab();
  const joinedRef = useRef(null);
  const joinGenRef = useRef(0);
  const effectGenRef = useRef(0);
  const mountGenRef = useRef(0);

  useEffect(() => {
    if (!spaceId) return undefined;

    const mountGen = nextSpaceCollabMountGen();
    mountGenRef.current = mountGen;
    const gen = ++effectGenRef.current;
    let cancelled = false;

    const hydrateFromFetch = async () => {
      const [nodesRes, connRes, commentsRes, guidesRes] = await Promise.all([
        fetchNodes(spaceId),
        fetchConnectors(spaceId),
        fetchComments(spaceId),
        fetchRulerGuides(spaceId),
      ]);
      if (cancelled || effectGenRef.current !== gen) return;
      useWhiteboardDocumentStore.getState().hydrateRoom({
        nodes: nodesRes.data || [],
        connectors: connRes.data || [],
        comments: commentsRes.data || [],
        rulerGuides: guidesRes.data || [],
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
        const [res, guidesRes] = await Promise.all([
          joinSpaceRoom(socket, spaceId),
          fetchRulerGuides(spaceId),
        ]);
        if (cancelled || effectGenRef.current !== gen || joinGenRef.current !== joinGen) return;
        joinedRef.current = spaceId;
        setGlobalJoinedSpaceId(spaceId);

        const local = useWhiteboardDocumentStore.getState();
        const incoming = {
          nodes: res.nodes || [],
          connectors: res.connectors || [],
          comments: res.comments || [],
        };
        if (!isStaleSpaceSnapshot(local, incoming)) {
          useWhiteboardDocumentStore.getState().hydrateRoom({
            ...incoming,
            rulerGuides: guidesRes.data || [],
            revision: res.revision ?? 0,
          });
        } else if (guidesRes.data?.length) {
          useWhiteboardDocumentStore.getState().setRulerGuides(guidesRes.data);
        }
        if (res.peers) flushPresenceSyncNow(res.peers);
      } catch (err) {
        console.warn('[SpaceCollabSync] join failed, falling back to fetch', err.message);
        if (!cancelled && effectGenRef.current === gen) await hydrateFromFetch();
      }
    };

    const onSocketDisconnect = () => {
      joinedRef.current = null;
      if (getGlobalJoinedSpaceId() === spaceId) clearGlobalJoinedSpaceId();
    };

    const onSocketConnect = () => {
      if (!cancelled && socket.connected) performJoin();
    };

    const onState = async (payload) => {
      if (cancelled || effectGenRef.current !== gen) return;
      const local = useWhiteboardDocumentStore.getState();
      const incoming = {
        nodes: payload.nodes || [],
        connectors: payload.connectors || [],
        comments: payload.comments || [],
      };
      const guidesRes = await fetchRulerGuides(spaceId);
      if (cancelled || effectGenRef.current !== gen) return;
      if (!isStaleSpaceSnapshot(local, incoming)) {
        useWhiteboardDocumentStore.getState().hydrateRoom({
          ...incoming,
          rulerGuides: guidesRes.data || [],
          revision: payload.revision ?? 0,
        });
      } else if (guidesRes.data?.length) {
        useWhiteboardDocumentStore.getState().setRulerGuides(guidesRes.data);
      }
      if (payload.peers) flushPresenceSyncNow(payload.peers);
    };

    const onPresenceSync = (payload) => {
      const payloadSpaceId = payload?.spaceId || payload?.roomId || null;
      const activeSpace = joinedRef.current || spaceId;
      if (payloadSpaceId && activeSpace && payloadSpaceId !== activeSpace) return;
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
      if (getSpaceCollabMountGen() !== mountGen) return;
      if (joinedRef.current === spaceId) {
        leaveRoom(socket).finally(() => {
          if (getGlobalJoinedSpaceId() === spaceId) clearGlobalJoinedSpaceId();
          joinedRef.current = null;
        });
      }
    };
  }, [spaceId, collab?.socket]);

  return null;
}
