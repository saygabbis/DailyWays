import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useCollab } from './CollabContext.jsx';
import { submitOp } from './collabClient.js';
import { isCollabEnabled } from './collabConfig.js';
import { uuidv4 } from '../utils/uuid';

/**
 * Padrão único de mutação de board:
 * 1. dispatch local (UI imediata)
 * 2. WebSocket (sala collab ativa + conectado)
 * 3. Supabase sempre (persistBoard — imediato fora da sala, debounce na sala)
 */

const DEBOUNCE_ACTIONS = new Set(['UPDATE_CARD', 'UPDATE_SUBTASK']);

const BoardCollabContext = createContext(null);

export function BoardCollabProvider({ children }) {
  const { dispatch, persistBoard } = useApp();
  const collab = useCollab();
  const [activeBoardId, setActiveBoardId] = useState(null);
  const debounceTimers = useRef(new Map());
  const roomReadyRef = useRef({});
  const pendingOpsRef = useRef({});

  const setCollabPending = useCallback((boardId, pending) => {
    if (!boardId) return;
    dispatch({ type: 'SET_PENDING_BOARD', payload: { boardId, pending } });
  }, [dispatch]);

  const setCollabSaving = useCallback((boardId, saving) => {
    if (!boardId) return;
    dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId, saving } });
  }, [dispatch]);

  const syncPendingFlag = useCallback((boardId) => {
    const queued = pendingOpsRef.current[boardId]?.length > 0;
    const debouncing = [...debounceTimers.current.keys()].some((k) => k.startsWith(`${boardId}:`));
    setCollabPending(boardId, queued || debouncing);
  }, [setCollabPending]);

  const isBoardRoomLive = useCallback((boardId) => {
    return Boolean(collab?.connected && roomReadyRef.current[boardId]);
  }, [collab?.connected]);

  const submitActionToServer = useCallback(async (boardId, action) => {
    const socket = collab?.socket;
    if (!socket?.connected || !boardId || !action?.type) return false;
    setCollabSaving(boardId, true);
    try {
      await submitOp(socket, {
        opId: uuidv4(),
        type: 'update',
        entity: 'board',
        id: boardId,
        field: 'action',
        value: action,
        clientTs: Date.now(),
      });
      return true;
    } catch (err) {
      console.warn('[boardCollab] op failed', err.message);
      persistBoard(boardId, { force: true, ensureSave: true });
      return false;
    } finally {
      setCollabSaving(boardId, false);
      syncPendingFlag(boardId);
    }
  }, [collab?.socket, persistBoard, setCollabSaving, syncPendingFlag]);

  const flushPendingOps = useCallback((boardId) => {
    const queue = pendingOpsRef.current[boardId];
    if (!queue?.length) return;
    delete pendingOpsRef.current[boardId];
    syncPendingFlag(boardId);
    if (!collab?.socket?.connected) {
      persistBoard(boardId, { force: true, ensureSave: true });
      return;
    }
    (async () => {
      for (const action of queue) {
        await submitActionToServer(boardId, action);
      }
    })();
  }, [collab?.socket, submitActionToServer, persistBoard, syncPendingFlag]);

  const setBoardRoomReady = useCallback((boardId, ready) => {
    if (!boardId) return;
    if (ready) {
      roomReadyRef.current[boardId] = true;
      flushPendingOps(boardId);
    } else {
      delete roomReadyRef.current[boardId];
      delete pendingOpsRef.current[boardId];
      setCollabPending(boardId, false);
      setCollabSaving(boardId, false);
    }
  }, [flushPendingOps, setCollabPending, setCollabSaving]);

  const sendBoardOp = useCallback((boardId, action) => {
    if (!boardId || !action?.type) return;

    if (!collab?.socket?.connected) return;

    if (!roomReadyRef.current[boardId]) {
      if (!pendingOpsRef.current[boardId]) pendingOpsRef.current[boardId] = [];
      pendingOpsRef.current[boardId].push(action);
      syncPendingFlag(boardId);
      return;
    }

    submitActionToServer(boardId, action);
  }, [collab?.socket, submitActionToServer, syncPendingFlag]);

  const emitBoardAction = useCallback((boardId, action) => {
    if (!boardId || !action?.type) return;

    const send = () => sendBoardOp(boardId, action);

    if (DEBOUNCE_ACTIONS.has(action.type)) {
      const key = `${boardId}:${action.type}:${action.payload?.cardId || ''}:${action.payload?.listId || ''}`;
      setCollabPending(boardId, true);
      if (debounceTimers.current.has(key)) clearTimeout(debounceTimers.current.get(key));
      debounceTimers.current.set(
        key,
        setTimeout(() => {
          debounceTimers.current.delete(key);
          send();
        }, 400),
      );
      return;
    }

    send();
  }, [sendBoardOp, setCollabPending]);

  const collabDispatchForBoard = useCallback((boardId, action) => {
    if (!action?.type || !boardId) return;

    dispatch(action);

    const collabOn = isCollabEnabled();
    const live = collabOn && isBoardRoomLive(boardId);
    const joiningActiveBoard = collabOn
      && collab?.connected
      && activeBoardId === boardId
      && !live;

    // #region agent log
    fetch('http://127.0.0.1:7493/ingest/0093f15a-2614-4c0e-9862-18929ca449cb', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ed15fe' }, body: JSON.stringify({ sessionId: 'ed15fe', location: 'BoardCollabContext.jsx:collabDispatchForBoard', message: 'board-mutate', data: { actionType: action.type, boardId, live, joiningActiveBoard, collabOn, connected: !!collab?.connected }, timestamp: Date.now(), hypothesisId: 'H-unified' }) }).catch(() => {});
    // #endregion

    if (collabOn && collab?.connected) {
      if (live) {
        emitBoardAction(boardId, action);
      } else if (joiningActiveBoard) {
        if (!pendingOpsRef.current[boardId]) pendingOpsRef.current[boardId] = [];
        pendingOpsRef.current[boardId].push(action);
        syncPendingFlag(boardId);
      }
    }

    persistBoard(boardId, {
      force: !live,
      ensureSave: true,
    });
  }, [
    dispatch,
    collab?.connected,
    activeBoardId,
    emitBoardAction,
    persistBoard,
    isBoardRoomLive,
    syncPendingFlag,
  ]);

  const collabDispatch = useCallback((action, explicitBoardId) => {
    const boardId =
      explicitBoardId
      || action?.payload?.boardId
      || activeBoardId;
    if (!boardId) {
      dispatch(action);
      return;
    }
    collabDispatchForBoard(boardId, action);
  }, [activeBoardId, collabDispatchForBoard, dispatch]);

  const value = useMemo(() => ({
    collabDispatch,
    collabDispatchForBoard,
    connected: collab?.connected ?? false,
    collabEnabled: isCollabEnabled(),
    activeBoardId,
    setActiveBoardId,
    setBoardRoomReady,
  }), [
    collabDispatch,
    collabDispatchForBoard,
    collab?.connected,
    activeBoardId,
    setActiveBoardId,
    setBoardRoomReady,
  ]);

  return (
    <BoardCollabContext.Provider value={value}>
      {children}
    </BoardCollabContext.Provider>
  );
}

export function useBoardCollabContext() {
  return useContext(BoardCollabContext);
}

export function useBoardCollabDispatch(boardId) {
  const ctx = useBoardCollabContext();
  const { dispatch } = useApp();

  const resolvedBoardId = boardId ?? ctx?.activeBoardId;

  const collabDispatch = useCallback(
    (action) => {
      if (ctx && resolvedBoardId) {
        ctx.collabDispatchForBoard(resolvedBoardId, action);
      } else if (ctx) {
        ctx.collabDispatch(action);
      } else {
        dispatch(action);
      }
    },
    [ctx, resolvedBoardId, dispatch],
  );

  const updateBoardMeta = useCallback(
    (updates) => {
      if (!resolvedBoardId) return;
      ctx?.collabDispatchForBoard(resolvedBoardId, {
        type: 'UPDATE_BOARD',
        payload: { id: resolvedBoardId, updates },
      });
    },
    [ctx, resolvedBoardId],
  );

  if (!ctx) {
    return {
      collabDispatch: dispatch,
      updateBoardMeta: () => {},
      connected: false,
      collabEnabled: false,
    };
  }

  return {
    collabDispatch,
    collabDispatchForBoard: ctx.collabDispatchForBoard,
    updateBoardMeta,
    connected: ctx.connected,
    collabEnabled: ctx.collabEnabled,
    activeBoardId: ctx.activeBoardId,
  };
}
