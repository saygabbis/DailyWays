import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { useCollab } from '../../core/CollabContext.jsx';
import { submitOp } from '../../core/collabClient.js';
import { isCollabEnabled } from '../../core/collabConfig.js';
import { uuidv4 } from '../../../utils/uuid';
import { useToast } from '../../../context/ToastContext.jsx';
import { toastCollabError } from '../../core/collabToast.js';
import {
  isImmediateBoardAction,
  shouldDebounceBoardAction,
} from './boardActionPriority.js';

/**
 * Padrão único de mutação de board:
 * 1. dispatch local (UI imediata)
 * 2. WebSocket (sala collab ativa + conectado)
 * 3. Supabase backup em ações imediatas (completed, move, add…)
 */

const TEXT_DEBOUNCE_MS = 180;
const OP_RETRY_ATTEMPTS = 2;
const OP_RETRY_DELAY_MS = 300;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const BoardCollabContext = createContext(null);

export function BoardCollabProvider({ children }) {
  const { dispatch, persistBoard } = useApp();
  const collab = useCollab();
  const { addToast } = useToast();
  const [activeBoardId, setActiveBoardId] = useState(null);
  const [roomReadyMap, setRoomReadyMap] = useState({});
  const debounceTimers = useRef(new Map());
  const debouncedActionsRef = useRef(new Map());
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

  const isBoardRoomReady = useCallback((boardId) => {
    if (!isCollabEnabled() || !boardId) return true;
    return Boolean(roomReadyMap[boardId]);
  }, [roomReadyMap]);

  const submitActionToServer = useCallback(async (boardId, action) => {
    const socket = collab?.socket;
    if (!socket?.connected || !boardId || !action?.type) return false;
    setCollabSaving(boardId, true);
    const opPayload = {
      opId: uuidv4(),
      type: 'update',
      entity: 'board',
      id: boardId,
      field: 'action',
      value: action,
      clientTs: Date.now(),
    };
    try {
      for (let attempt = 0; attempt <= OP_RETRY_ATTEMPTS; attempt += 1) {
        try {
          if (!socket?.connected) throw new Error('Socket not connected');
          await submitOp(socket, opPayload);
          if (isImmediateBoardAction(action)) {
            persistBoard(boardId, { force: true, ensureSave: true });
          }
          return true;
        } catch (err) {
          if (attempt < OP_RETRY_ATTEMPTS) {
            await sleep(OP_RETRY_DELAY_MS);
            continue;
          }
          throw err;
        }
      }
      return true;
    } catch (err) {
      console.warn('[boardCollab] op failed', err.message);
      const msg = err.message?.includes('Rate limit')
        ? 'Muitas alterações ao mesmo tempo. Aguarde um instante.'
        : 'Alteração no board não foi sincronizada. Salvando localmente…';
      toastCollabError(addToast, msg);
      persistBoard(boardId, { force: true, ensureSave: true });
      return false;
    } finally {
      setCollabSaving(boardId, false);
      syncPendingFlag(boardId);
    }
  }, [collab?.socket, persistBoard, setCollabSaving, syncPendingFlag, addToast]);

  useEffect(() => () => {
    for (const timer of debounceTimers.current.values()) {
      clearTimeout(timer);
    }
    debounceTimers.current.clear();
    debouncedActionsRef.current.clear();
    pendingOpsRef.current = {};
  }, []);

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
    setRoomReadyMap((prev) => ({ ...prev, [boardId]: !!ready }));
    if (ready) {
      roomReadyRef.current[boardId] = true;
      flushPendingOps(boardId);
    } else {
      delete roomReadyRef.current[boardId];
      setCollabSaving(boardId, false);
    }
  }, [flushPendingOps, setCollabSaving]);

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

  useEffect(() => {
    const flushDebounced = () => {
      for (const [key, action] of debouncedActionsRef.current.entries()) {
        const boardId = key.split(':')[0];
        const timer = debounceTimers.current.get(key);
        if (timer) clearTimeout(timer);
        debounceTimers.current.delete(key);
        if (boardId && action) sendBoardOp(boardId, action);
      }
      debouncedActionsRef.current.clear();
    };
    const onHide = () => {
      if (document.visibilityState !== 'hidden') return;
      flushDebounced();
    };
    window.addEventListener('pagehide', flushDebounced);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flushDebounced);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [sendBoardOp]);

  const emitBoardAction = useCallback((boardId, action) => {
    if (!boardId || !action?.type) return;

    const send = () => sendBoardOp(boardId, action);

    if (shouldDebounceBoardAction(action)) {
      const key = `${boardId}:${action.type}:${action.payload?.cardId || ''}:${action.payload?.listId || ''}`;
      setCollabPending(boardId, true);
      debouncedActionsRef.current.set(key, action);
      if (debounceTimers.current.has(key)) clearTimeout(debounceTimers.current.get(key));
      debounceTimers.current.set(
        key,
        setTimeout(() => {
          debounceTimers.current.delete(key);
          debouncedActionsRef.current.delete(key);
          send();
        }, TEXT_DEBOUNCE_MS),
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

    if (collabOn && collab?.connected) {
      if (live) {
        emitBoardAction(boardId, action);
      } else if (joiningActiveBoard) {
        if (!pendingOpsRef.current[boardId]) pendingOpsRef.current[boardId] = [];
        pendingOpsRef.current[boardId].push(action);
        syncPendingFlag(boardId);
      }
    }

    if (live && isImmediateBoardAction(action)) {
      persistBoard(boardId, { force: true, ensureSave: true });
    } else if (!live && !joiningActiveBoard) {
      persistBoard(boardId, { force: true, ensureSave: true });
    } else if (live && shouldDebounceBoardAction(action)) {
      persistBoard(boardId, { force: false });
    }
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
    isBoardRoomReady,
  }), [
    collabDispatch,
    collabDispatchForBoard,
    collab?.connected,
    activeBoardId,
    setActiveBoardId,
    setBoardRoomReady,
    isBoardRoomReady,
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
      isBoardRoomReady: () => true,
    };
  }

  return {
    collabDispatch,
    collabDispatchForBoard: ctx.collabDispatchForBoard,
    updateBoardMeta,
    connected: ctx.connected,
    collabEnabled: ctx.collabEnabled,
    activeBoardId: ctx.activeBoardId,
    isBoardRoomReady: ctx.isBoardRoomReady,
  };
}
