import { useEffect, useRef, useCallback } from 'react';

import { SERVER_EVENTS } from '@dailyways/collab-protocol';

import { useApp } from '../context/AppContext';

import { useAuth } from '../context/AuthContext';

import { usePresenceStore } from './presenceStore';

import { queuePresenceSync, flushPresenceSyncNow } from './queuePresenceSync.js';

import { useCollab } from './CollabContext.jsx';

import { useBoardCollabContext } from './BoardCollabContext.jsx';

import { joinBoardRoom, leaveRoom } from './collabClient.js';

import { resetPresenceFields, announcePresence } from './presenceBridge.js';

import {
  publishBoardPresenceFull,
  scheduleBoardPresencePublish,
} from './boardPresencePublish.js';

import { isCollabEnabled } from './collabConfig.js';

import { collabDebugLog } from './collabDebug.js';

import { pulseRemoteCard } from './boardRemoteAnim.js';

import {

  getGlobalJoinedBoardId,

  setGlobalJoinedBoardId,

  clearGlobalJoinedBoardId,

  nextBoardCollabMountGen,

  getBoardCollabMountGen,

} from './boardCollabSession.js';



export default function BoardCollabSync({ boardId, boardViewActive = true }) {

  const collab = useCollab();

  const { user, profile } = useAuth();

  const boardCollab = useBoardCollabContext();

  const { dispatch, setCollabActiveBoardId, setCollabConnectedForBoard } = useApp();

  const joinedRef = useRef(null);

  const effectGenRef = useRef(0);

  const joinGenRef = useRef(0);

  const presenceBumpTimerRef = useRef(null);

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

  }, [collab?.socket, boardId]);



  useEffect(() => {

    setCollabConnectedForBoard(!!collab?.connected);

  }, [collab?.connected, setCollabConnectedForBoard]);



  useEffect(() => {

    return () => {

      usePresenceStore.getState().clearPeers();

    };

  }, [boardId]);



  const boardViewActiveRef = useRef(boardViewActive);

  boardViewActiveRef.current = boardViewActive;



  /** Ao voltar à vista do board, re-publica presença para o outro cliente voltar a ver o cursor. */
  useEffect(() => {
    if (!boardViewActive || !boardId || !collab?.socket?.connected) return undefined;

    const socket = collab.socket;
    let cancelled = false;

    const republish = () => {
      if (cancelled || !boardViewActiveRef.current || !socket?.connected) return;
      scheduleBoardPresencePublish(socket, boardId, authRef.current);
      announcePresence(boardId);
    };

    if (joinedRef.current === boardId) {
      republish();
      return () => { cancelled = true; };
    }

    joinBoardRoom(socket, boardId)
      .then((res) => {
        if (cancelled) return;
        joinedRef.current = boardId;
        setGlobalJoinedBoardId(boardId);
        setCollabActiveBoardId(boardId);
        if (res.peers) flushPresenceSyncNow(res.peers);
        republish();
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [boardViewActive, boardId, collab?.socket, collab?.connected, setCollabActiveBoardId]);



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

    const mountGen = nextBoardCollabMountGen();



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

      const joinGen = ++joinGenRef.current;

      try {

        joinedRef.current = null;

        boardCollabRef.current?.setBoardRoomReady?.(joiningBoardId, false);



        const res = await joinBoardRoom(socket, joiningBoardId);

        if (cancelled || effectGenRef.current !== gen || joinGenRef.current !== joinGen) {

          return;

        }



        joinedRef.current = joiningBoardId;

        setGlobalJoinedBoardId(joiningBoardId);

        setCollabActiveBoardId(joiningBoardId);

        boardCollabRef.current?.setActiveBoardId?.(joiningBoardId);

        boardCollabRef.current?.setBoardRoomReady?.(joiningBoardId, true);



        const publishPresenceAfterPaint = () => {

          if (cancelled || effectGenRef.current !== gen) return;

          scheduleBoardPresencePublish(socket, joiningBoardId, authRef.current);

        };

        publishPresenceAfterPaint();



        const alreadyHydrated = hydratedBoardIdsRef.current.has(joiningBoardId);

        if (!alreadyHydrated && res.board) {

          applyBoardSnapshot(res.board);

          hydratedBoardIdsRef.current.add(joiningBoardId);

        }

        if (res.peers) flushPresenceSyncNow(res.peers);

        if (presenceBumpTimerRef.current) clearTimeout(presenceBumpTimerRef.current);
        presenceBumpTimerRef.current = setTimeout(() => {
          presenceBumpTimerRef.current = null;
          if (cancelled || effectGenRef.current !== gen || joinedRef.current !== joiningBoardId) return;
          scheduleBoardPresencePublish(socket, joiningBoardId, authRef.current);
        }, 800);

        // #region agent log

        fetch('http://127.0.0.1:7493/ingest/0093f15a-2614-4c0e-9862-18929ca449cb',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ed15fe'},body:JSON.stringify({sessionId:'ed15fe',runId:'presence-v3',hypothesisId:'H1-H3',location:'BoardCollabSync.jsx:performJoin',message:'board join ok',data:{boardId:joiningBoardId,reason,mountGen:getBoardCollabMountGen(),peerCount:res.peers?.length??0,otherCount:(res.peers||[]).filter((p)=>p.userId&&p.userId!==authRef.current.user?.id).length},timestamp:Date.now()})}).catch(()=>{});

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

        if (cancelled || effectGenRef.current !== gen) return;

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



    const scheduleJoinWhenConnected = (reason, { force = false } = {}) => {

      if (cancelled || effectGenRef.current !== gen) return;

      if (!force && joinedRef.current === joiningBoardId && socket.connected) return;

      const run = () => {

        if (cancelled || effectGenRef.current !== gen) return;

        if (!socket.connected) return;

        performJoin(reason);

      };

      if (socket.connected) run();

      else socket.once('connect', run);

    };



    const onSocketDisconnect = () => {

      joinedRef.current = null;

      boardCollabRef.current?.setBoardRoomReady?.(joiningBoardId, false);

      // #region agent log

      fetch('http://127.0.0.1:7493/ingest/0093f15a-2614-4c0e-9862-18929ca449cb',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ed15fe'},body:JSON.stringify({sessionId:'ed15fe',runId:'presence-v3',hypothesisId:'H5',location:'BoardCollabSync.jsx:disconnect',message:'socket disconnect reset join',data:{boardId:joiningBoardId},timestamp:Date.now()})}).catch(()=>{});

      // #endregion

    };



    const onSocketReconnect = () => scheduleJoinWhenConnected('socket-reconnect', { force: true });

    const onSocketConnect = () => scheduleJoinWhenConnected('socket-connect', { force: true });



    const onVisibility = () => {

      if (document.visibilityState !== 'visible' || cancelled) return;

      if (joinedRef.current !== joiningBoardId) {

        scheduleJoinWhenConnected('visibility', { force: true });

        return;

      }

      publishNow();

    };



    const onPageShow = () => scheduleJoinWhenConnected('pageshow', { force: true });



    socket.on('disconnect', onSocketDisconnect);

    socket.on('connect', onSocketConnect);

    socket.io?.on('reconnect', onSocketReconnect);

    document.addEventListener('visibilitychange', onVisibility);

    window.addEventListener('pageshow', onPageShow);



    if (socket.connected) {

      performJoin('effect');

    } else {

      boardCollabRef.current?.setBoardRoomReady?.(boardId, false);

    }



    return () => {

      cancelled = true;

      if (presenceBumpTimerRef.current) {
        clearTimeout(presenceBumpTimerRef.current);
        presenceBumpTimerRef.current = null;
      }

      socket.off(SERVER_EVENTS.PRESENCE_SYNC, onPresenceSync);

      socket.off('disconnect', onSocketDisconnect);

      socket.off('connect', onSocketConnect);

      socket.io?.off('reconnect', onSocketReconnect);

      document.removeEventListener('visibilitychange', onVisibility);

      window.removeEventListener('pageshow', onPageShow);



      const boardAtCleanup = joiningBoardId;

      resetPresenceFields(boardAtCleanup);

      prevDragCardByUserRef.current.clear();



      // #region agent log

      fetch('http://127.0.0.1:7493/ingest/0093f15a-2614-4c0e-9862-18929ca449cb',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ed15fe'},body:JSON.stringify({sessionId:'ed15fe',runId:'presence-v3',hypothesisId:'H2',location:'BoardCollabSync.jsx:cleanup',message:'board cleanup',data:{boardAtCleanup,mountGen,currentMountGen:getBoardCollabMountGen(),globalJoined:getGlobalJoinedBoardId(),willLeave:getGlobalJoinedBoardId()===boardAtCleanup},timestamp:Date.now()})}).catch(()=>{});

      // #endregion

      if (getGlobalJoinedBoardId() === boardAtCleanup) {

        leaveRoom(socket, boardAtCleanup, { mountGen }).finally(() => {

          if (getBoardCollabMountGen() !== mountGen) return;

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

  }, [boardId, collab?.socket, dispatch, setCollabActiveBoardId, setCollabConnectedForBoard, publishNow]);



  useEffect(() => {

    return () => {

      hydratedBoardIdsRef.current.delete(boardId);

    };

  }, [boardId]);



  useEffect(() => {

    if (!joinedRef.current || joinedRef.current !== boardId) return;

    if (!collab?.socket?.connected) return;

    publishNow();

  }, [boardId, user?.id, profile?.name, profile?.photo_url, profile?.presence_color, collab?.socket, publishNow]);



  return null;

}


