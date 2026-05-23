import { useEffect, useRef } from 'react';
import { SERVER_EVENTS } from '@dailyways/collab-protocol';
import { useWhiteboardDocumentStore } from '../../../stores/whiteboardDocumentStore';
import { queuePresenceSync, flushPresenceSyncNow } from '../../board/presence/queuePresenceSync.js';
import { useCollab } from '../../core/CollabContext.jsx';
import { joinSpaceRoom, leaveRoom } from '../../core/collabClient.js';
import { isCollabEnabled } from '../../core/collabConfig.js';
import { fetchNodes, fetchConnectors, fetchComments } from '../../../services/whiteboardService';
import { isStaleWhiteboardSnapshot } from './whiteboardFingerprint.js';
import {
    getGlobalJoinedSpaceId,
    setGlobalJoinedSpaceId,
    clearGlobalJoinedSpaceId,
    nextWhiteboardCollabMountGen,
    getWhiteboardCollabMountGen,
} from './whiteboardCollabSession.js';

export default function WhiteboardCollabSync({ spaceId }) {
    const collab = useCollab();
    const joinedRef = useRef(null);
    const joinGenRef = useRef(0);
    const effectGenRef = useRef(0);
    const mountGenRef = useRef(0);

    useEffect(() => {
        if (!spaceId) return undefined;

        const mountGen = nextWhiteboardCollabMountGen();
        mountGenRef.current = mountGen;
        const gen = ++effectGenRef.current;
        let cancelled = false;

        const hydrateFromFetch = async () => {
            const [nodesRes, connRes, commentsRes] = await Promise.all([
                fetchNodes(spaceId),
                fetchConnectors(spaceId),
                fetchComments(spaceId),
            ]);
            if (cancelled || effectGenRef.current !== gen) return;
            useWhiteboardDocumentStore.getState().hydrateRoom({
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
                setGlobalJoinedSpaceId(spaceId);

                const local = useWhiteboardDocumentStore.getState();
                const incoming = {
                    nodes: res.nodes || [],
                    connectors: res.connectors || [],
                    comments: res.comments || [],
                };
                if (!isStaleWhiteboardSnapshot(local, incoming)) {
                    useWhiteboardDocumentStore.getState().hydrateRoom({
                        ...incoming,
                        revision: res.revision ?? 0,
                    });
                }
                if (res.peers) flushPresenceSyncNow(res.peers);
            } catch (err) {
                console.warn('[WhiteboardCollabSync] join failed, falling back to fetch', err.message);
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

        const onState = (payload) => {
            if (cancelled || effectGenRef.current !== gen) return;
            const local = useWhiteboardDocumentStore.getState();
            const incoming = {
                nodes: payload.nodes || [],
                connectors: payload.connectors || [],
                comments: payload.comments || [],
            };
            if (!isStaleWhiteboardSnapshot(local, incoming)) {
                useWhiteboardDocumentStore.getState().hydrateRoom({
                    ...incoming,
                    revision: payload.revision ?? 0,
                });
            }
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
            if (getWhiteboardCollabMountGen() !== mountGen) return;
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
