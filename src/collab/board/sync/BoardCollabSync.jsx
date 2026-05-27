import { useEffect, useRef, useCallback } from 'react';

import { SERVER_EVENTS } from '@dailyways/collab-protocol';

import { useApp } from '../../../context/AppContext';
import {
  boardStructuralFingerprint,
  isStaleBoardSnapshot,
} from './boardFingerprint.js';

import { useAuth } from '../../../context/AuthContext';

import { usePresenceStore } from '../presence/presenceStore';

import { queuePresenceSync, flushPresenceSyncNow } from '../presence/queuePresenceSync.js';

import { useCollab } from '../../core/CollabContext.jsx';

import { useBoardCollabContext } from '../ops/BoardCollabContext.jsx';

import { joinBoardRoom, leaveRoom } from '../../core/collabClient.js';

import { resetPresenceFields, announcePresence } from '../presence/presenceBridge.js';

import {
  publishBoardPresenceFull,
  scheduleBoardPresencePublish,
  prepareBoardSurfacePresence,
} from '../presence/boardPresencePublish.js';

import { isCollabEnabled } from '../../core/collabConfig.js';

import { collabDebugLog } from '../../core/collabDebug.js';

import { pulseRemoteCard, pulseRemoteList } from '../ui/boardRemoteAnim.js';

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

  const {
    dispatch,
    setCollabActiveBoardId,
    setCollabConnectedForBoard,
    state,
    pendingBoardIds,
    savingBoardIds,
  } = useApp();

  const boardsRef = useRef(state.boards);
  const pendingBoardIdsRef = useRef(pendingBoardIds);
  const savingBoardIdsRef = useRef(savingBoardIds);
  boardsRef.current = state.boards;
  pendingBoardIdsRef.current = pendingBoardIds;
  savingBoardIdsRef.current = savingBoardIds;

  const joinedRef = useRef(null);

  const effectGenRef = useRef(0);

  const joinGenRef = useRef(0);

  const presenceBumpTimerRef = useRef(null);

  const hydratedBoardIdsRef = useRef(new Set());

  const boardCollabRef = useRef(boardCollab);

  const prevDragCardByUserRef = useRef(new Map());
  const prevDragListByUserRef = useRef(new Map());

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



  /** Vista do board ativa: só republica (o join ao trocar board fica no efeito principal). */
  useEffect(() => {
    if (!boardViewActive || !boardId || !collab?.socket?.connected) return undefined;
    if (joinedRef.current !== boardId) return undefined;

    const socket = collab.socket;
    let cancelled = false;

    const republish = () => {
      if (cancelled || !boardViewActiveRef.current || !socket?.connected) return;
      prepareBoardSurfacePresence(boardId);
      scheduleBoardPresencePublish(socket, boardId, authRef.current);
      announcePresence(boardId);
    };

    republish();
    const raf = requestAnimationFrame(republish);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [boardViewActive, boardId, collab?.socket, collab?.connected]);



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
      if (
        pendingBoardIdsRef.current.includes(board.id)
        || savingBoardIdsRef.current.includes(board.id)
      ) {
        return;
      }
      const current = boardsRef.current.find((b) => b.id === board.id);
      if (!current) {
        dispatch({
          type: 'UPDATE_BOARD',
          payload: { id: board.id, updates: board },
        });
        return;
      }
      if (isStaleBoardSnapshot(current, board)) {
        return;
      }
      if (boardStructuralFingerprint(current) === boardStructuralFingerprint(board)) {
        return;
      }
      dispatch({
        type: 'UPDATE_BOARD',
        payload: { id: board.id, updates: board },
      });
    };



    const onPresenceSync = (payload) => {

      const peers = payload?.peers;

      if (!peers) return;

      const syncBoardId = payload?.boardId;
      const activeBoard = joinedRef.current || joiningBoardId;
      if (syncBoardId && activeBoard && syncBoardId !== activeBoard) return;

      const myId = authRef.current.user?.id;

      const remoteIds = new Set();

      for (const peer of peers) {

        if (!peer?.userId || peer.userId === myId) continue;

        remoteIds.add(peer.userId);

        const prevCard = prevDragCardByUserRef.current.get(peer.userId);

        if (prevCard && !peer.draggingCardId) {

          pulseRemoteCard(prevCard);

        }

        prevDragCardByUserRef.current.set(

          peer.userId,

          peer.draggingCardId || null,

        );

        const prevList = prevDragListByUserRef.current.get(peer.userId);
        const listDragId = peer.draggingListId && !peer.draggingCardId
          ? peer.draggingListId
          : null;

        if (prevList && !listDragId) {
          pulseRemoteList(prevList);
        }

        prevDragListByUserRef.current.set(peer.userId, listDragId);

      }

      for (const uid of [...prevDragCardByUserRef.current.keys()]) {

        if (!remoteIds.has(uid)) prevDragCardByUserRef.current.delete(uid);

      }

      for (const uid of [...prevDragListByUserRef.current.keys()]) {

        if (!remoteIds.has(uid)) prevDragListByUserRef.current.delete(uid);

      }

      queuePresenceSync(peers);

    };



    const performJoin = async (reason) => {

      const joinGen = ++joinGenRef.current;

      try {

        const prevBoard = getGlobalJoinedBoardId() || joinedRef.current;

        joinedRef.current = null;
        clearGlobalJoinedBoardId();

        boardCollabRef.current?.setBoardRoomReady?.(joiningBoardId, false);

        if (prevBoard && prevBoard !== joiningBoardId && socket.connected) {

          await leaveRoom(socket, prevBoard);

          clearGlobalJoinedBoardId();

        }



        const res = await joinBoardRoom(socket, joiningBoardId);

        if (cancelled || effectGenRef.current !== gen || joinGenRef.current !== joinGen) {

          return;

        }



        joinedRef.current = joiningBoardId;

        setGlobalJoinedBoardId(joiningBoardId);

        setCollabActiveBoardId(joiningBoardId);

        boardCollabRef.current?.setActiveBoardId?.(joiningBoardId);

        const alreadyHydrated = hydratedBoardIdsRef.current.has(joiningBoardId);

        if (!alreadyHydrated && res.board) {
          applyBoardSnapshot(res.board);
          hydratedBoardIdsRef.current.add(joiningBoardId);
        }

        boardCollabRef.current?.setBoardRoomReady?.(joiningBoardId, true);

        prepareBoardSurfacePresence(joiningBoardId);

        const publishPresenceAfterPaint = () => {
          if (cancelled || effectGenRef.current !== gen) return;
          scheduleBoardPresencePublish(socket, joiningBoardId, authRef.current);
          announcePresence(joiningBoardId);
        };

        publishPresenceAfterPaint();

        if (res.peers) flushPresenceSyncNow(res.peers);

        if (presenceBumpTimerRef.current) clearTimeout(presenceBumpTimerRef.current);
        presenceBumpTimerRef.current = setTimeout(() => {
          presenceBumpTimerRef.current = null;
          if (cancelled || effectGenRef.current !== gen || joinedRef.current !== joiningBoardId) return;
          scheduleBoardPresencePublish(socket, joiningBoardId, authRef.current);
        }, 800);

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

      clearGlobalJoinedBoardId();

      boardCollabRef.current?.setBoardRoomReady?.(joiningBoardId, false);

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

    const onCollabSocketReconnected = () => scheduleJoinWhenConnected('token-refresh', { force: true });



    socket.on('disconnect', onSocketDisconnect);

    socket.on('connect', onSocketConnect);

    socket.io?.on('reconnect', onSocketReconnect);

    document.addEventListener('visibilitychange', onVisibility);

    window.addEventListener('pageshow', onPageShow);

    window.addEventListener('collab-socket-reconnected', onCollabSocketReconnected);



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

      window.removeEventListener('collab-socket-reconnected', onCollabSocketReconnected);



      const boardAtCleanup = joiningBoardId;

      resetPresenceFields(boardAtCleanup);

      prevDragCardByUserRef.current.clear();
      prevDragListByUserRef.current.clear();

      const shouldLeaveRoom = getGlobalJoinedBoardId() === boardAtCleanup;

      clearGlobalJoinedBoardId();

      joinedRef.current = null;

      if (shouldLeaveRoom) {

        leaveRoom(socket, boardAtCleanup, { mountGen }).finally(() => {

          if (getBoardCollabMountGen() !== mountGen) return;

        });

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


