import { validateBoardActionLimits } from '@dailyways/limits';
import { resolveLimitError } from '../../../limits/messages.js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useCollab } from '../../core/CollabContext.jsx';
import {
  recordBoardHistory,
  commitPendingTextHistory,
  flushAllPendingTextHistory,
  registerTextHistoryFlush,
} from '../history/boardHistoryController.js';
import {
  historyDebounceKey,
  stashTextHistoryPending,
} from '../history/boardHistoryCoalesce.js';
import { useBoardHistoryStore } from '../history/boardHistoryStore.js';
import { ensureBoardHistoryHydrated } from '../history/boardHistorySync.js';
import { submitOp } from '../../core/collabClient.js';
import { isCollabEnabled } from '../../core/collabConfig.js';
import { uuidv4 } from '../../../utils/uuid';
import { useToast } from '../../../context/ToastContext.jsx';
import { toastCollabError } from '../../core/collabToast.js';
import {
  shouldDebounceBoardAction,
  shouldBackupBoardActionToSupabase,
} from './boardActionPriority.js';
import { isBoardPrankFrozen } from '../dev/boardDevPrank.js';

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
  const { dispatch, persistBoard, flushBoardPersist, setCollabBoardRoomLive, state } = useApp();
  const { user } = useAuth();
  const collab = useCollab();
  const boardsRef = useRef(state.boards);
  boardsRef.current = state.boards;
  const { addToast } = useToast();
  const [activeBoardId, setActiveBoardId] = useState(null);
  const [roomReadyMap, setRoomReadyMap] = useState({});
  const roomReadyMapRef = useRef(roomReadyMap);
  roomReadyMapRef.current = roomReadyMap;
  const debounceTimers = useRef(new Map());
  const debouncedActionsRef = useRef(new Map());
  const roomReadyRef = useRef({});
  const pendingOpsRef = useRef({});
  const textHistoryPendingRef = useRef(new Map());
  const textHistoryCommitTimers = useRef(new Map());

  useEffect(() => {
    useBoardHistoryStore.getState().initForUser(user?.id ?? null);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !activeBoardId) return;
    let cancelled = false;
    (async () => {
      await ensureBoardHistoryHydrated(user.id, activeBoardId);
    })();
    return () => { cancelled = true; };
  }, [user?.id, activeBoardId]);

  const getBoardSnapshot = useCallback((boardId) => {
    const b = boardsRef.current.find((x) => x.id === boardId);
    return b ? JSON.parse(JSON.stringify(b)) : null;
  }, []);

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
    return Boolean(roomReadyMapRef.current[boardId]);
  }, []);

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
          if (shouldBackupBoardActionToSupabase(action)) {
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
    const nextReady = !!ready;
    setRoomReadyMap((prev) => {
      if (!!prev[boardId] === nextReady) return prev;
      return { ...prev, [boardId]: nextReady };
    });
    if (ready) {
      roomReadyRef.current[boardId] = true;
      setCollabBoardRoomLive(true);
      flushPendingOps(boardId);
    } else {
      delete roomReadyRef.current[boardId];
      setCollabBoardRoomLive(false);
      setCollabSaving(boardId, false);
    }
  }, [flushPendingOps, setCollabSaving, setCollabBoardRoomLive]);

  const sendBoardOp = useCallback((boardId, action) => {
    if (!boardId || !action?.type) return Promise.resolve(false);

    if (!collab?.socket?.connected) return Promise.resolve(false);

    if (!roomReadyRef.current[boardId]) {
      if (!pendingOpsRef.current[boardId]) pendingOpsRef.current[boardId] = [];
      pendingOpsRef.current[boardId].push(action);
      syncPendingFlag(boardId);
      return Promise.resolve(false);
    }

    return submitActionToServer(boardId, action);
  }, [collab?.socket, submitActionToServer, syncPendingFlag]);

  useEffect(() => {
    const flushDebounced = () => {
      for (const timer of textHistoryCommitTimers.current.values()) {
        clearTimeout(timer);
      }
      textHistoryCommitTimers.current.clear();
      flushAllPendingTextHistory(textHistoryPendingRef.current);
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

  const commitTextHistoryForKey = useCallback((boardId, key) => {
    const pending = textHistoryPendingRef.current.get(key);
    if (!pending) return;
    commitPendingTextHistory(boardId, pending);
    textHistoryPendingRef.current.delete(key);
    const timer = textHistoryCommitTimers.current.get(key);
    if (timer) {
      clearTimeout(timer);
      textHistoryCommitTimers.current.delete(key);
    }
  }, []);

  const scheduleTextHistoryCommit = useCallback((boardId, key) => {
    const existing = textHistoryCommitTimers.current.get(key);
    if (existing) clearTimeout(existing);
    textHistoryCommitTimers.current.set(
      key,
      setTimeout(() => {
        textHistoryCommitTimers.current.delete(key);
        commitTextHistoryForKey(boardId, key);
      }, TEXT_DEBOUNCE_MS),
    );
  }, [commitTextHistoryForKey]);

  useEffect(() => {
    const flushTextHistoryForBoard = (boardId) => {
      if (!boardId) return;
      for (const [key, timer] of textHistoryCommitTimers.current.entries()) {
        if (!key.startsWith(`${boardId}:`)) continue;
        clearTimeout(timer);
        textHistoryCommitTimers.current.delete(key);
        commitTextHistoryForKey(boardId, key);
      }
      flushAllPendingTextHistory(textHistoryPendingRef.current, boardId);
    };
    registerTextHistoryFlush(flushTextHistoryForBoard);
    return () => registerTextHistoryFlush(null);
  }, [commitTextHistoryForKey]);

  const emitBoardAction = useCallback((boardId, action, options = {}) => {
    if (!boardId || !action?.type) return Promise.resolve();

    const send = () => sendBoardOp(boardId, action);

    if (shouldDebounceBoardAction(action) && !options.skipHistory) {
      const key = historyDebounceKey(boardId, action);
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
      return Promise.resolve();
    }

    return send();
  }, [sendBoardOp, setCollabPending]);

  const collabDispatchForBoard = useCallback(async (boardId, action, options = {}) => {
    if (!action?.type || !boardId) return;
    if (isBoardPrankFrozen()) return;

    const board = getBoardSnapshot(boardId);
    const limitErr = validateBoardActionLimits(board, action);
    if (limitErr) {
      addToast(resolveLimitError(limitErr), 'error');
      return;
    }

    const textDebounced = shouldDebounceBoardAction(action) && !options.skipHistory;

    if (!options.skipHistory) {
      if (textDebounced) {
        const key = historyDebounceKey(boardId, action);
        stashTextHistoryPending(
          textHistoryPendingRef.current,
          boardId,
          getBoardSnapshot(boardId),
          action,
        );
        scheduleTextHistoryCommit(boardId, key);
      } else {
        flushAllPendingTextHistory(textHistoryPendingRef.current, boardId);
        recordBoardHistory(boardId, getBoardSnapshot(boardId), action);
      }
    }

    dispatch(action);

    const collabOn = isCollabEnabled();
    const live = collabOn && isBoardRoomLive(boardId);
    const joiningActiveBoard = collabOn
      && collab?.connected
      && activeBoardId === boardId
      && !live;

    const collabConnected = collabOn && collab?.connected;
    const offRoom = collabConnected && !live;

    // Socket só com sala do board ativa (vista Board). Fora da sala → só Supabase (sem toast).
    if (collabConnected && live) {
      const sendOp = async () => {
        if (shouldDebounceBoardAction(action) && !options.skipHistory) {
          if (options.awaitCollab) {
            await emitBoardAction(boardId, action, options);
          } else {
            emitBoardAction(boardId, action, options);
          }
          return;
        }
        if (options.awaitCollab) {
          await submitActionToServer(boardId, action);
        } else {
          emitBoardAction(boardId, action, options);
        }
      };

      if (options.awaitCollab) {
        await sendOp();
      } else if (joiningActiveBoard) {
        if (!pendingOpsRef.current[boardId]) pendingOpsRef.current[boardId] = [];
        pendingOpsRef.current[boardId].push(action);
        syncPendingFlag(boardId);
      } else {
        sendOp().catch((err) => console.warn('[boardCollab] op failed', err?.message));
      }
    } else if (collabConnected && joiningActiveBoard) {
      if (!pendingOpsRef.current[boardId]) pendingOpsRef.current[boardId] = [];
      pendingOpsRef.current[boardId].push(action);
      syncPendingFlag(boardId);
    }

    const needsDbBackup = !options.deferPersist && (
      options.forcePersist
      || (offRoom && (options.skipHistory || shouldBackupBoardActionToSupabase(action)))
      || (!collabConnected && !options.skipHistory && shouldBackupBoardActionToSupabase(action))
    );

    if (needsDbBackup) {
      if (options.awaitPersist && flushBoardPersist) {
        await flushBoardPersist(boardId);
      } else {
        persistBoard(boardId, { force: true, ensureSave: true });
      }
    }
  }, [
    dispatch,
    collab?.connected,
    activeBoardId,
    emitBoardAction,
    persistBoard,
    isBoardRoomLive,
    syncPendingFlag,
    getBoardSnapshot,
    flushBoardPersist,
    scheduleTextHistoryCommit,
    addToast,
  ]);

  const collabDispatch = useCallback((action, explicitBoardId, options) => {
    const boardId =
      explicitBoardId
      || action?.payload?.boardId
      || activeBoardId;
    if (!boardId) {
      dispatch(action);
      return;
    }
    collabDispatchForBoard(boardId, action, options);
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
    (action, options) => {
      if (ctx && resolvedBoardId) {
        ctx.collabDispatchForBoard(resolvedBoardId, action, options);
      } else if (ctx) {
        ctx.collabDispatch(action, resolvedBoardId, options);
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
