import { useEffect, useRef, useCallback } from 'react';
import { SERVER_EVENTS } from '@dailyways/collab-protocol';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { usePresenceStore } from './presenceStore';
import { queuePresenceSync, flushPresenceSyncNow } from './queuePresenceSync.js';
import { useCollab } from './CollabContext.jsx';
import { useBoardCollabContext } from './BoardCollabContext.jsx';
import { joinBoardRoom, leaveRoom } from './collabClient.js';
import { resetPresenceFields } from './presenceBridge.js';
import { publishBoardPresenceFull } from './boardPresencePublish.js';
import { isCollabEnabled } from './collabConfig.js';
import { collabDebugLog } from './collabDebug.js';
import { pulseRemoteCard } from './boardRemoteAnim.js';
import {
  getGlobalJoinedBoardId,
  setGlobalJoinedBoardId,
  clearGlobalJoinedBoardId,
} from './boardCollabSession.js';

export default function BoardCollabSync({ boardId }) {
  const collab = useCollab();
  const { user, profile } = useAuth();
  const boardCollab = useBoardCollabContext();
  const { dispatch, setCollabActiveBoardId, setCollabConnectedForBoard } = useApp();
  const joinedRef = useRef(null);
  const effectGenRef = useRef(0);
  const hydratedBoardIdsRef = useRef(new Set());
  const boardCollabRef = useRef(boardCollab);
  const prevDragCardByUserRef = useRef(new Map());
  const authRef = useRef({ user, profile });
  authRef.current = { user, profile };
  boardCollabRef.current = boardCollab;

  const publishNow = useCallback(() => {
    const socket = collab?.socket;
    const id = boardId || joinedRef.current;
    if (!socket?.connected || !id) return;
    publishBoardPresenceFull(socket, id, authRef.current);
  }, [collab?.socket, collab?.connected, boardId]);

  useEffect(() => {
    setCollabConnectedForBoard(!!collab?.connected);
  }, [collab?.connected, setCollabConnectedForBoard]);

  useEffect(() => {
    if (!boardId) return undefined;

    if (!isCollabEnabled() || !collab?.socket) {
      setCollabActiveBoardId(null);
      boardCollabRef.current?.setActiveBoardId?.(null);
      boardCollabRef.current?.setBoardRoomReady?.(boardId, false);
      return undefined;
    }

    const socket = collab.socket;
    let cancelled = false;
    const joiningBoardId = boardId;
    const gen = ++effectGenRef.current;

    const applyBoardSnapshot = (board) => {
      if (!board || cancelled) return;
      dispatch({
        type: 'UPDATE_BOARD',
        payload: { id: board.id, updates: board },
      });
    };

    const onPresenceSync = (payload) => {
      const peers = payload?.peers;
      if (!peers) return;
      const myId = authRef.current.user?.id;
      for (const peer of peers) {
        if (!peer?.userId || peer.userId === myId) continue;
        const prevCard = prevDragCardByUserRef.current.get(peer.userId);
        if (prevCard && !peer.draggingCardId) {
          pulseRemoteCard(prevCard);
        }
        prevDragCardByUserRef.current.set(
          peer.userId,
          peer.draggingCardId || null,
        );
      }
      queuePresenceSync(peers);
    };

    const performJoin = async (reason) => {
      try {
        await leaveRoom(socket);
        joinedRef.current = null;

        const res = await joinBoardRoom(socket, joiningBoardId);
        if (cancelled || effectGenRef.current !== gen) return;

        joinedRef.current = joiningBoardId;
        setGlobalJoinedBoardId(joiningBoardId);
        setCollabActiveBoardId(joiningBoardId);
        boardCollabRef.current?.setActiveBoardId?.(joiningBoardId);
        boardCollabRef.current?.setBoardRoomReady?.(joiningBoardId, true);

        publishBoardPresenceFull(socket, joiningBoardId, authRef.current);

        const alreadyHydrated = hydratedBoardIdsRef.current.has(joiningBoardId);
        if (!alreadyHydrated && res.board) {
          applyBoardSnapshot(res.board);
          hydratedBoardIdsRef.current.add(joiningBoardId);
        }
        if (res.peers) flushPresenceSyncNow(res.peers);
        // #region agent log
        fetch('http://127.0.0.1:7493/ingest/0093f15a-2614-4c0e-9862-18929ca449cb',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ed15fe'},body:JSON.stringify({sessionId:'ed15fe',runId:'post-fix',hypothesisId:'H1-H3',location:'BoardCollabSync.jsx:performJoin',message:'board join ok',data:{boardId:joiningBoardId,reason,peerCount:res.peers?.length??0,globalJoined:getGlobalJoinedBoardId()},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        collabDebugLog('board-join-ok', {
          boardId: joiningBoardId,
          peerCount: res.peers?.length ?? 0,
          peers: (res.peers || []).map((p) => ({
            id: p.userId?.slice(0, 8),
            name: p.name,
            hasCursor: !!(p.cursor && typeof p.cursor.x === 'number'),
          })),
        });
      } catch (err) {
        console.warn('[BoardCollabSync] join failed', err.message);
        boardCollabRef.current?.setBoardRoomReady?.(joiningBoardId, false);
        joinedRef.current = null;
        if (getGlobalJoinedBoardId() === joiningBoardId) {
          clearGlobalJoinedBoardId();
        }
        setCollabActiveBoardId(null);
        boardCollabRef.current?.setActiveBoardId?.(null);
      }
    };

    socket.on(SERVER_EVENTS.PRESENCE_SYNC, onPresenceSync);

    const onSocketReconnect = () => {
      if (cancelled || effectGenRef.current !== gen) return;
      performJoin('socket-reconnect');
    };

    const onVisibility = () => {
      if (document.visibilityState !== 'visible' || cancelled) return;
      if (joinedRef.current !== joiningBoardId) return;
      publishNow();
    };

    socket.io?.on('reconnect', onSocketReconnect);
    document.addEventListener('visibilitychange', onVisibility);

    if (collab.connected) {
      performJoin('effect');
    } else {
      boardCollabRef.current?.setBoardRoomReady?.(boardId, false);
    }

    return () => {
      cancelled = true;
      socket.off(SERVER_EVENTS.PRESENCE_SYNC, onPresenceSync);
      socket.io?.off('reconnect', onSocketReconnect);
      document.removeEventListener('visibilitychange', onVisibility);

      const boardAtCleanup = joiningBoardId;
      resetPresenceFields(boardAtCleanup);
      prevDragCardByUserRef.current.clear();
      usePresenceStore.getState().clearPeers();

      // #region agent log
      fetch('http://127.0.0.1:7493/ingest/0093f15a-2614-4c0e-9862-18929ca449cb',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ed15fe'},body:JSON.stringify({sessionId:'ed15fe',runId:'post-fix',hypothesisId:'H1-H2',location:'BoardCollabSync.jsx:cleanup',message:'board cleanup',data:{boardAtCleanup,globalJoined:getGlobalJoinedBoardId(),willLeave:getGlobalJoinedBoardId()===boardAtCleanup},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (getGlobalJoinedBoardId() === boardAtCleanup) {
        leaveRoom(socket, boardAtCleanup).finally(() => {
          if (getGlobalJoinedBoardId() === boardAtCleanup) {
            clearGlobalJoinedBoardId();
          }
        });
        joinedRef.current = null;
        boardCollabRef.current?.setBoardRoomReady?.(boardAtCleanup, false);
        setCollabActiveBoardId(null);
        boardCollabRef.current?.setActiveBoardId?.(null);
      }
    };
  }, [boardId, collab?.socket, collab?.connected, dispatch, setCollabActiveBoardId, setCollabConnectedForBoard, publishNow]);

  useEffect(() => {
    return () => {
      hydratedBoardIdsRef.current.delete(boardId);
    };
  }, [boardId]);

  useEffect(() => {
    if (!joinedRef.current || joinedRef.current !== boardId) return;
    if (!collab?.socket?.connected) return;
    publishNow();
  }, [boardId, user?.id, profile?.name, profile?.photo_url, profile?.presence_color, collab?.connected, publishNow]);

  return null;
}
