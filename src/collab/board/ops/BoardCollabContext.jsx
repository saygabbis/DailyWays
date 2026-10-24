import { validateBoardActionLimits } from '@dailyways/limits';
import {
  BOARD_ACTION_TYPES,
  normalizeBoardAction,
  sanitizeBoardAction,
} from '@dailyways/collab-protocol';
import { resolveLimitError } from '../../../limits/messages.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../../context/useApp';
import { useAuth } from '../../../context/useAuth';
import { useCollab } from '../../core/useCollab';
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
import { submitBoardOp, submitOp } from '../../core/collabClient.js';
import { isCollabEnabled } from '../../core/collabConfig.js';
import { uuidv4 } from '../../../utils/uuid';
import { useToast } from '../../../context/useToast';
import { toastCollabError } from '../../core/collabToast.js';
import {
  shouldDebounceBoardAction,
  shouldBackupBoardActionToSupabase,
} from './boardActionPriority.js';
import { isBoardPrankFrozen } from '../dev/boardDevPrank.js';
import { BoardCollabContext } from './useBoardCollab';
import { boardOutbox } from './boardOutboxInstance.js';
import { useLatestRef } from '../../../hooks/useLatestRef';
import { waitForBoardCreation } from '../../../services/boardService';

/**
 * Padrão único de mutação de board:
 * 1. normaliza a ação (ids, "marcar como") e aplica localmente (UI imediata);
 * 2. com a sala do board ao vivo (ou entrando/reconectando): fila de saída (boardOutbox), que
 *    funde edições seguidas do mesmo item, envia em ordem e reenvia depois de reconectar;
 * 3. fora da sala, com socket: op avulsa pelo servidor (board:op);
 * 4. sem collab: o navegador grava (fallback).
 */

const TEXT_DEBOUNCE_MS = 180;
/** Campos não-texto (cor, prioridade, datas…): junta o que chegar nesse intervalo numa op só. */
const FIELD_BATCH_MS = 80;
const RATE_LIMIT_RETRY_MS = 500;
/** Socket caído por mais que isso com ops na fila → o navegador grava (collab fora do ar). */
const OFFLINE_FALLBACK_MS = 5000;
const OFF_ROOM_ATTEMPTS = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function boardActionOp(boardId, action, opId = uuidv4()) {
  return {
    opId,
    type: 'update',
    entity: 'board',
    id: boardId,
    field: 'action',
    value: action,
    clientTs: Date.now(),
  };
}

function sendDelayFor(action) {
  if (shouldDebounceBoardAction(action)) return TEXT_DEBOUNCE_MS;
  if (String(action?.type).startsWith('UPDATE_')) return FIELD_BATCH_MS;
  return 0;
}

const isTransientError = (msg = '') => /not connected|timeout|Not in room|Rate limit|Board prank/i.test(msg);

export function BoardCollabProvider({ children }) {
  const { dispatch, persistBoard, flushBoardPersist, setCollabBoardRoomLive, markBoardLocalEdit, state } = useApp();
  const { user } = useAuth();
  const collab = useCollab();
  const boardsRef = useLatestRef(state.boards);
  const { addToast } = useToast();
  const [activeBoardId, setActiveBoardId] = useState(null);
  const [roomReadyMap, setRoomReadyMap] = useState({});
  const roomReadyMapRef = useLatestRef(roomReadyMap);
  const roomReadyRef = useRef({});
  const sendTimers = useRef(new Map());
  const inflight = useRef(new Map());
  const offlineTimers = useRef(new Map());
  const textHistoryPendingRef = useRef(new Map());
  const textHistoryCommitTimers = useRef(new Map());
  const socketRef = useLatestRef(collab?.socket);
  const flushOutboxRef = useRef(null);

  useEffect(() => {
    useBoardHistoryStore.getState().initForUser(user?.id ?? null);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !activeBoardId) return;
    void ensureBoardHistoryHydrated(user.id, activeBoardId);
  }, [user?.id, activeBoardId]);

  const getBoardSnapshot = useCallback((boardId) => {
    const b = boardsRef.current.find((x) => x.id === boardId);
    return b ? JSON.parse(JSON.stringify(b)) : null;
  }, [boardsRef]);

  const setCollabPending = useCallback((boardId, pending) => {
    if (!boardId) return;
    dispatch({ type: 'SET_PENDING_BOARD', payload: { boardId, pending } });
  }, [dispatch]);

  const setCollabSaving = useCallback((boardId, saving) => {
    if (!boardId) return;
    dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId, saving } });
  }, [dispatch]);

  const syncPendingFlag = useCallback((boardId) => {
    setCollabPending(boardId, boardOutbox.pendingCount(boardId) > 0);
  }, [setCollabPending]);

  /** Mostra o estado "confirmado + pendentes" (depois de recusa ou rebase). */
  const showBoard = useCallback((boardId, board) => {
    if (!board) return;
    dispatch({ type: 'UPDATE_BOARD', payload: { id: boardId, updates: { lists: board.lists, title: board.title, emoji: board.emoji, color: board.color } } });
  }, [dispatch]);

  const isBoardRoomLive = useCallback((boardId) => {
    return Boolean(collab?.connected && roomReadyRef.current[boardId]);
  }, [collab?.connected]);

  const isBoardRoomReady = useCallback((boardId) => {
    if (!isCollabEnabled() || !boardId) return true;
    return Boolean(roomReadyMapRef.current[boardId]);
  }, [roomReadyMapRef]);

  /** Op avulsa (fora da sala). Mesmo opId nas tentativas: o servidor não aplica duas vezes. */
  const submitOffRoom = useCallback(async (boardId, op) => {
    let lastErr = null;
    for (let attempt = 0; attempt < OFF_ROOM_ATTEMPTS; attempt += 1) {
      try {
        await submitBoardOp(socketRef.current, boardId, op);
        return true;
      } catch (err) {
        lastErr = err;
        if (!isTransientError(err?.message)) break;
        await sleep(RATE_LIMIT_RETRY_MS * (attempt + 1));
      }
    }
    console.warn('[boardCollab] off-room op failed', lastErr?.message);
    return false;
  }, [socketRef]);

  const sendEntry = useCallback((boardId, entry) => {
    const socket = socketRef.current;
    const op = boardActionOp(boardId, entry.action, entry.opId);
    const promise = submitOp(socket, op)
      .then((res) => {
        if (res?.duplicate) {
          boardOutbox.dropDuplicate(boardId, entry.opId);
        } else if (boardOutbox.pendingActions(boardId).includes(entry.action)) {
          // Ack sem o eco (raro): confirma por aqui.
          boardOutbox.applyServerOp(boardId, entry.opId, entry.action);
        }
        return true;
      })
      .catch(async (err) => {
        const msg = err?.message || '';
        if (/Not in room/i.test(msg)) {
          // Saiu do board antes do servidor processar: entrega como op avulsa.
          const ok = await submitOffRoom(boardId, op);
          boardOutbox.dropDuplicate(boardId, entry.opId);
          if (!ok) persistBoard(boardId, { force: true, ensureSave: true });
          return ok;
        }
        if (isTransientError(msg)) {
          // Volta para a fila: reenvia já (limite/timeout com socket de pé) ou no próximo join.
          boardOutbox.markUnsent(boardId, entry.opId);
          setTimeout(() => flushOutboxRef.current?.(boardId), RATE_LIMIT_RETRY_MS);
          return false;
        }
        console.warn('[boardCollab] op recusada', msg);
        showBoard(boardId, boardOutbox.reject(boardId, entry.opId));
        toastCollabError(addToast, 'Uma alteração não foi aceita pelo servidor e foi desfeita.');
        return false;
      })
      .finally(() => {
        inflight.current.delete(entry.opId);
        syncPendingFlag(boardId);
      });
    inflight.current.set(entry.opId, promise);
    return promise;
  }, [socketRef, submitOffRoom, persistBoard, showBoard, addToast, syncPendingFlag]);

  const flushOutbox = useCallback((boardId) => {
    const timer = sendTimers.current.get(boardId);
    if (timer) clearTimeout(timer);
    sendTimers.current.delete(boardId);
    if (!socketRef.current?.connected) return;
    const entries = boardOutbox.takeUnsent(boardId);
    if (!entries.length) return;
    if (roomReadyRef.current[boardId]) {
      for (const entry of entries) void sendEntry(boardId, entry);
      return;
    }
    // Sem sala (saiu do board ou o join falhou): entrega em ordem como ops avulsas.
    void (async () => {
      for (const entry of entries) {
        const ok = await submitOffRoom(boardId, boardActionOp(boardId, entry.action, entry.opId));
        boardOutbox.dropDuplicate(boardId, entry.opId);
        if (!ok) persistBoard(boardId, { force: true, ensureSave: true });
      }
      syncPendingFlag(boardId);
    })();
  }, [socketRef, sendEntry, submitOffRoom, persistBoard, syncPendingFlag]);

  useEffect(() => {
    flushOutboxRef.current = flushOutbox;
  }, [flushOutbox]);

  /** Socket caído com op nova na fila: se não voltar logo, o navegador grava o board. */
  const armOfflineFallback = useCallback((boardId) => {
    const timers = offlineTimers.current;
    if (timers.has(boardId)) return;
    timers.set(boardId, setTimeout(() => {
      timers.delete(boardId);
      if (socketRef.current?.connected) return;
      boardOutbox.clearPending(boardId);
      syncPendingFlag(boardId);
      persistBoard(boardId, { force: true, ensureSave: true });
    }, OFFLINE_FALLBACK_MS));
  }, [socketRef, persistBoard, syncPendingFlag]);

  const scheduleFlush = useCallback((boardId, delay) => {
    const existing = sendTimers.current.get(boardId);
    if (existing && delay > 0) return; // já tem envio marcado; a fusão cuida do resto
    if (existing) clearTimeout(existing);
    sendTimers.current.set(boardId, setTimeout(() => flushOutbox(boardId), delay));
  }, [flushOutbox]);

  // Socket caiu com ops na fila: espera a reconexão um pouco; se não voltar, o navegador grava.
  useEffect(() => {
    const timers = offlineTimers.current;
    if (collab?.connected) {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
      return;
    }
    for (const boardId of boardOutbox.boardsWithPending()) armOfflineFallback(boardId);
  }, [collab?.connected, armOfflineFallback]);

  useEffect(() => () => {
    for (const timer of sendTimers.current.values()) clearTimeout(timer);
    sendTimers.current.clear();
  }, []);

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
      flushOutbox(boardId);
    } else {
      // Saindo da sala: o que ainda não foi enviado vai agora (o servidor processa antes do leave).
      if (roomReadyRef.current[boardId]) flushOutbox(boardId);
      delete roomReadyRef.current[boardId];
      setCollabBoardRoomLive(false);
      setCollabSaving(boardId, false);
    }
  }, [flushOutbox, setCollabSaving, setCollabBoardRoomLive]);

  // Aba escondida/fechando: envia já o que está esperando a janela de fusão.
  useEffect(() => {
    const flushAll = () => {
      for (const timer of textHistoryCommitTimers.current.values()) clearTimeout(timer);
      textHistoryCommitTimers.current.clear();
      flushAllPendingTextHistory(textHistoryPendingRef.current);
      for (const boardId of [...sendTimers.current.keys()]) flushOutbox(boardId);
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushAll();
    };
    window.addEventListener('pagehide', flushAll);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flushAll);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [flushOutbox]);

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

  const collabDispatchForBoard = useCallback(async (boardId, rawAction, options = {}) => {
    if (!rawAction?.type || !boardId) return;
    if (isBoardPrankFrozen()) return;
    if (!BOARD_ACTION_TYPES.has(rawAction.type)) {
      dispatch(rawAction);
      return;
    }

    const board = getBoardSnapshot(boardId);
    const action = normalizeBoardAction(sanitizeBoardAction(rawAction), board);
    const limitErr = validateBoardActionLimits(board, action);
    if (limitErr) {
      addToast(resolveLimitError(limitErr), 'error');
      return;
    }

    if (!options.skipHistory) {
      if (shouldDebounceBoardAction(action)) {
        const key = historyDebounceKey(boardId, action);
        stashTextHistoryPending(textHistoryPendingRef.current, boardId, board, action);
        scheduleTextHistoryCommit(boardId, key);
      } else {
        flushAllPendingTextHistory(textHistoryPendingRef.current, boardId);
        recordBoardHistory(boardId, board, action);
      }
    }

    dispatch(action);
    markBoardLocalEdit?.(boardId);

    const collabOn = isCollabEnabled();
    const connected = collabOn && Boolean(collab?.connected);
    const inRoomFlow = collabOn && (
      roomReadyRef.current[boardId]
      || activeBoardId === boardId
    );

    // Board aberto (sala ao vivo, entrando ou reconectando): fila de saída.
    if (inRoomFlow && (connected || offlineTimers.current.has(boardId) || boardOutbox.hasConfirmed(boardId))) {
      const opId = boardOutbox.enqueue(boardId, action, uuidv4());
      syncPendingFlag(boardId);
      if (!connected) {
        armOfflineFallback(boardId); // reenvia ao reconectar; se demorar, o navegador grava
        return;
      }
      if (options.awaitCollab) {
        flushOutbox(boardId);
        await inflight.current.get(opId);
        return;
      }
      scheduleFlush(boardId, sendDelayFor(action));
      return;
    }

    // Fora da sala, com socket: o servidor aplica e grava (o navegador só grava se ele recusar).
    if (connected) {
      setCollabSaving(boardId, true);
      // Board acabou de ser criado: o servidor só pode carregá-lo depois das listas no banco.
      await waitForBoardCreation(boardId);
      const ok = await submitOffRoom(boardId, boardActionOp(boardId, action));
      setCollabSaving(boardId, false);
      if (!ok) persistBoard(boardId, { force: true, ensureSave: true });
      return;
    }

    // Sem collab: o navegador grava.
    const needsDbBackup = !options.deferPersist && (
      options.forcePersist || shouldBackupBoardActionToSupabase(action) || action.type === 'UPDATE_BOARD'
    );
    if (needsDbBackup) {
      if (options.awaitPersist && flushBoardPersist) {
        await flushBoardPersist(boardId);
      } else {
        persistBoard(boardId, { force: true, ensureSave: true });
      }
    }
  }, [getBoardSnapshot, dispatch, markBoardLocalEdit, collab?.connected, activeBoardId, addToast, scheduleTextHistoryCommit, syncPendingFlag, armOfflineFallback, flushOutbox, scheduleFlush, setCollabSaving, submitOffRoom, flushBoardPersist, persistBoard]);

  const collabDispatch = useCallback((action, explicitBoardId, options) => {
    const boardId =
      explicitBoardId
      || action?.payload?.boardId
      || (action?.type === 'UPDATE_BOARD' ? action?.payload?.id : null)
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
    isBoardRoomLive,
    flushBoardOutbox: flushOutbox,
  }), [
    collabDispatch,
    collabDispatchForBoard,
    collab?.connected,
    activeBoardId,
    setActiveBoardId,
    setBoardRoomReady,
    isBoardRoomReady,
    isBoardRoomLive,
    flushOutbox,
  ]);

  return (
    <BoardCollabContext.Provider value={value}>
      {children}
    </BoardCollabContext.Provider>
  );
}
