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

export default function BoardCollabSync({ boardId }) {
  const collab = useCollab();
  const { user, profile } = useAuth();
  const boardCollab = useBoardCollabContext();
  const { dispatch, setCollabActiveBoardId, setCollabConnectedForBoard } = useApp();
  const joinedRef = useRef(null);
  const effectGenRef = useRef(0);
  const hydratedBoardIdsRef = useRef(new Set());
  const boardCollabRef = useRef(boardCollab);
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
      if (payload?.peers) queuePresenceSync(payload.peers);
    };

    const performJoin = async (reason) => {
      try {
        leaveRoom(socket);
        joinedRef.current = null;

        const res = await joinBoardRoom(socket, joiningBoardId);
        if (cancelled || effectGenRef.current !== gen) return;

        joinedRef.current = joiningBoardId;
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
      } catch (err) {
        console.warn('[BoardCollabSync] join failed', err.message);
        boardCollabRef.current?.setBoardRoomReady?.(joiningBoardId, false);
        joinedRef.current = null;
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
      const cleanupGen = gen;
      queueMicrotask(() => {
        if (effectGenRef.current !== cleanupGen) return;
        if (joinedRef.current !== boardAtCleanup) return;
        resetPresenceFields(boardAtCleanup);
        leaveRoom(socket);
        joinedRef.current = null;
        boardCollabRef.current?.setBoardRoomReady?.(boardAtCleanup, false);
        setCollabActiveBoardId(null);
        boardCollabRef.current?.setActiveBoardId?.(null);
        usePresenceStore.getState().clearPeers();
      });
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
