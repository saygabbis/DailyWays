/**
 * Persistência dos boards no Supabase (fila por board, retry, revert) + quem é a fonte da verdade.
 * Com a sala de collab ao vivo o servidor collab persiste; aqui o navegador só grava como fallback.
 */
import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabaseClient';
import { updateBoardFull } from '../../services/boardService';
import { logger } from '../../utils/logger';
import { isCollabEnabled } from '../../collab/core/collabConfig.js';
import { isBoardServerAuthoritative as isServerAuthoritativeFor } from '../../collab/board/sync/persistAuthority.js';
import { isBoardPrankFrozen } from '../../collab/board/dev/boardDevPrank.js';

export function useBoardPersistence({ userId, userIdRef, dispatch, stateRef, initialLoadDone }) {
    const saveTimeoutRef = useRef({});
    const saveInProgressRef = useRef({});  // tracks active saves per boardId; 'saving' | 'queued'
    // Unix timestamp (ms): ignore Realtime echo refetches until this time.
    // Set whenever THIS tab starts a local write to avoid overwriting optimistic state.
    const realtimeSuppressUntilRef = useRef(0);
    // Counter de saves ativos: enquanto > 0, o Realtime NÃO deve sobrescrever o estado local.
    // Isso evita que dados stale do servidor apaguem mudanças locais quando o upsert ainda está em andamento.
    const activeSavesRef = useRef(0);
    const collabActiveBoardIdRef = useRef(null);
    const collabConnectedRef = useRef(false);
    const collabBoardRoomLiveRef = useRef(false);
    // boardId → instante da última edição local. O refetch do Realtime não pode trocar esses
    // boards por um retrato do banco que ainda não tem a edição (piscava o valor antigo).
    const recentLocalEditsRef = useRef(new Map());

    const markBoardLocalEdit = useCallback((boardId) => {
        if (boardId) recentLocalEditsRef.current.set(boardId, Date.now());
    }, []);

    const setCollabActiveBoardId = useCallback((boardId) => {
        collabActiveBoardIdRef.current = boardId || null;
    }, []);

    const setCollabConnectedForBoard = useCallback((connected) => {
        collabConnectedRef.current = !!connected;
    }, []);

    const setCollabBoardRoomLive = useCallback((live) => {
        collabBoardRoomLiveRef.current = !!live;
    }, []);

    // Sala ao vivo → o servidor collab persiste; o navegador só grava como fallback.
    const isBoardServerAuthoritative = useCallback((boardId) => isServerAuthoritativeFor({
        collabEnabled: isCollabEnabled(),
        boardId,
        activeBoardId: collabActiveBoardIdRef.current,
        connected: collabConnectedRef.current,
        roomLive: collabBoardRoomLiveRef.current,
    }), []);
    // Timestamp até quando aguardar antes de fazer HTTP (após TOKEN_REFRESHED).
    // O Supabase client tem um lock interno durante o refresh que trava requisições HTTP.
    // Após TOKEN_REFRESHED, aguardamos 2s para o lock ser liberado.
    const tokenRefreshCooldownRef = useRef(0);

    // Rastreia TOKEN_REFRESHED e SIGNED_IN para aplicar cooldown antes de requisições HTTP.
    // Ambos os eventos causam um lock interno no Supabase client que trava HTTP requests
    // feitos logo em seguida (save imediatamente após refresh de aba minimizada, etc.).
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
                logger.debug(`[AppContext] ${event}: cooldown de 2s ativado para requisições HTTP`);
                tokenRefreshCooldownRef.current = Date.now() + 2000;
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    // ── Persistence: Optimized ──
    // Removemos o useEffect global que salvava tudo a cada mudança (causava race conditions).
    // Agora salvamos mudanças estruturais IMEDIATAMENTE e mudanças de texto com debounce por board.

    // Suppress Realtime echo refetches for 'ms' milliseconds from now.
    // Called before every local write so this tab ignores its own echo.
    const suppressRealtime = useCallback((ms = 2000) => {
        realtimeSuppressUntilRef.current = Date.now() + ms;
    }, []);

    // Helper central: retorna o userId ativo para uso nos saves.
    // → PRIMEIRO tenta o userIdRef (atualizado pelo onAuthStateChange do Supabase —
    //   não bloqueia durante token refresh, pois o Supabase client renova o token
    //   automaticamente nas chamadas HTTP sem precisarmos chamar getSession()).
    // → Fallback: chama getSession() com timeout de 8s caso o ref esteja vazio
    //   (sessão totalmente nula / logout real).
    const getFreshUserId = useCallback(async () => {
        // Fast path: se já temos o userId do contexto, retorna imediatamente.
        // O token será renovado automaticamente pelo Supabase client na chamada HTTP.
        if (userIdRef.current) {
            // Cooldown após TOKEN_REFRESHED: aguarda o lock interno do Supabase client ser liberado.
            // Sem isso, requisições HTTP logo após o refresh ficam presas no lock e travam.
            const cooldownMs = tokenRefreshCooldownRef.current - Date.now();
            if (cooldownMs > 0) {
                logger.debug(`[AppContext] getFreshUserId: aguardando cooldown pós-TOKEN_REFRESHED (${Math.round(cooldownMs)}ms)`);
                await new Promise(resolve => setTimeout(resolve, cooldownMs));
            }
            return userIdRef.current;
        }

        // Slow path: sessão pode estar null (primeira carga ou logout) — verifica no servidor.
        try {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('getSession timeout')), 8000)
            );
            const { data, error } = await Promise.race([
                supabase.auth.getSession(),
                timeoutPromise,
            ]);
            if (error || !data?.session?.user?.id) {
                logger.warn('[AppContext] getFreshUserId: sessão inválida ou expirada', error?.message);
                return null;
            }
            // Atualiza o ref com o valor recém obtido
            userIdRef.current = data.session.user.id;
            return data.session.user.id;
        } catch (err) {
            logger.error('[AppContext] getFreshUserId error:', err.message);
            return null;
        }
    }, [userIdRef]);

    const shouldPersistBoard = useCallback((boardId, { force = false } = {}) => {
        if (!boardId) return true;
        if (force) return true;
        if (
            isCollabEnabled() &&
            collabActiveBoardIdRef.current === boardId &&
            collabConnectedRef.current
        ) {
            return false;
        }
        return true;
    }, []);

    const executeBoardPersistNow = useCallback(async (boardId) => {
        if (!userId || !initialLoadDone.current || !boardId) return;
        if (isBoardServerAuthoritative(boardId)) {
            dispatch({ type: 'SET_PENDING_BOARD', payload: { boardId, pending: false } });
            return;
        }

        if (saveInProgressRef.current[boardId]) {
            saveInProgressRef.current[boardId] = 'queued';
            const start = Date.now();
            while (saveInProgressRef.current[boardId] && Date.now() - start < 22000) {
                await new Promise((r) => setTimeout(r, 40));
            }
            if (saveInProgressRef.current[boardId]) return;
        }

        dispatch({ type: 'SET_PENDING_BOARD', payload: { boardId, pending: false } });
        dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId, saving: true } });
        activeSavesRef.current += 1;
        suppressRealtime(8000);

        const safetyTimer = setTimeout(() => {
            logger.warn('[AppContext] executeBoardPersistNow: safety timeout (20s) para board', boardId);
            const stuckBoard = stateRef.current.boards.find((b) => b.id === boardId);
            activeSavesRef.current = Math.max(0, activeSavesRef.current - 1);
            if (activeSavesRef.current === 0) suppressRealtime(2000);
            dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId, saving: false } });
            dispatch({ type: 'SET_PENDING_BOARD', payload: { boardId, pending: false } });
            delete saveTimeoutRef.current[boardId];
            delete saveInProgressRef.current[boardId];
            dispatch({
                type: 'PUSH_SAVE_ERROR',
                payload: {
                    boardId,
                    boardTitle: stuckBoard?.title,
                    boardSnapshot: stuckBoard ? JSON.parse(JSON.stringify(stuckBoard)) : null,
                    error: 'Timeout: save travou. Verifique sua conexão.',
                },
            });
        }, 20000);

        let saveAgain = true;
        let lastError = null;
        saveInProgressRef.current[boardId] = 'saving';

        while (saveAgain) {
            saveAgain = false;
            saveInProgressRef.current[boardId] = 'saving';

            try {
                const board = stateRef.current.boards.find((b) => b.id === boardId);
                if (!board) {
                    logger.warn('[AppContext] executeBoardPersistNow: board não encontrado', boardId);
                    break;
                }

                const freshUserId = await getFreshUserId();
                if (!freshUserId) {
                    logger.warn('[AppContext] executeBoardPersistNow: sem sessão válida', boardId);
                    dispatch({
                        type: 'PUSH_SAVE_ERROR',
                        payload: { boardId, boardTitle: board?.title, boardSnapshot: null, error: 'Sessão expirada' },
                    });
                    break;
                }

                logger.debug(`[AppContext] executeBoardPersistNow: salvando "${board.title}"`);
                const result = await updateBoardFull(freshUserId, board);
                if (!result?.success) {
                    throw new Error(result?.error || 'Falha ao salvar board');
                }
                lastError = null;
            } catch (err) {
                logger.error('[AppContext] executeBoardPersistNow error:', err);
                lastError = err;
            }

            if (saveInProgressRef.current[boardId] === 'queued') {
                saveAgain = true;
                suppressRealtime(8000);
            }
        }

        if (lastError) {
            const board = stateRef.current.boards.find((b) => b.id === boardId);
            dispatch({
                type: 'PUSH_SAVE_ERROR',
                payload: { boardId, boardTitle: board?.title, boardSnapshot: null, error: lastError?.message || 'Falha ao salvar' },
            });
        }

        clearTimeout(safetyTimer);
        activeSavesRef.current = Math.max(0, activeSavesRef.current - 1);
        if (activeSavesRef.current === 0) suppressRealtime(2000);
        dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId, saving: false } });
        delete saveTimeoutRef.current[boardId];
        delete saveInProgressRef.current[boardId];
    }, [userId, initialLoadDone, isBoardServerAuthoritative, dispatch, suppressRealtime, stateRef, getFreshUserId]);

    const flushBoardPersist = useCallback(async (boardId) => {
        if (!userId || !initialLoadDone.current || !boardId) return;
        if (!shouldPersistBoard(boardId, { force: true })) return;

        const timeouts = saveTimeoutRef.current || {};
        if (timeouts[boardId]) {
            clearTimeout(timeouts[boardId]);
            delete timeouts[boardId];
        }
        dispatch({ type: 'SET_PENDING_BOARD', payload: { boardId, pending: false } });
        suppressRealtime(8000);
        await executeBoardPersistNow(boardId);
    }, [userId, initialLoadDone, shouldPersistBoard, dispatch, suppressRealtime, executeBoardPersistNow]);

    // Helper para salvar um board específico de forma eficiente
    const persistBoard = useCallback(async (boardId, options = {}) => {
        if (isBoardPrankFrozen()) return;
        if (!userId || !initialLoadDone.current || !boardId) return;
        if (isBoardServerAuthoritative(boardId)) return;
        if (!options.ensureSave && !shouldPersistBoard(boardId, options)) return;

        const timeouts = saveTimeoutRef.current || {};
        if (timeouts[boardId]) {
            clearTimeout(timeouts[boardId]);
        }

        suppressRealtime(2000);
        dispatch({ type: 'SET_PENDING_BOARD', payload: { boardId, pending: true } });

        timeouts[boardId] = setTimeout(() => {
            void executeBoardPersistNow(boardId);
        }, options.force ? 0 : 180);

        saveTimeoutRef.current = timeouts;
    }, [userId, initialLoadDone, isBoardServerAuthoritative, shouldPersistBoard, suppressRealtime, dispatch, executeBoardPersistNow]);

    /** Espera os saves do navegador deste board terminarem (antes de entrar na sala do collab). */
    const waitForBoardSaves = useCallback(async (boardId, timeoutMs = 15000) => {
        const start = Date.now();
        while (
            (saveInProgressRef.current[boardId] || saveTimeoutRef.current?.[boardId])
            && Date.now() - start < timeoutMs
        ) {
            await new Promise((r) => setTimeout(r, 50));
        }
    }, []);

    // Salva todos os boards com debounce pendente imediatamente (usado pelo botão flutuante)
    const saveAllPending = useCallback(async () => {
        const timeouts = saveTimeoutRef.current || {};
        const timerIds = Object.keys(timeouts);
        const flaggedIds = stateRef.current.pendingBoardIds || [];
        const boardIds = [...new Set([...timerIds, ...flaggedIds])];
        if (!boardIds.length) return;

        timerIds.forEach((id) => clearTimeout(timeouts[id]));
        saveTimeoutRef.current = {};
        suppressRealtime(8000);

        await Promise.all(boardIds.map((boardId) => flushBoardPersist(boardId)));
    }, [stateRef, suppressRealtime, flushBoardPersist]);

    // Helper interno compartilhado para persistência imediata com rollback + token refresh
    const persistBoardImmediate = useCallback(async (boardId, updates, options = {}) => {
        if (isBoardPrankFrozen()) return;
        if (!boardId) return;
        if (!shouldPersistBoard(boardId, options)) {
            dispatch({ type: 'UPDATE_BOARD', payload: { id: boardId, updates } });
            return;
        }
        // Snapshot do estado ANTES das mudanças locais (para rollback)
        const prevBoard = stateRef.current.boards.find(b => b.id === boardId);
        const boardSnapshot = prevBoard ? JSON.parse(JSON.stringify(prevBoard)) : null;

        dispatch({ type: 'UPDATE_BOARD', payload: { id: boardId, updates } });
        dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId, saving: true } });
        suppressRealtime(8000);
        activeSavesRef.current += 1;

        const safetyTimer = setTimeout(() => {
            logger.warn('[AppContext] persistBoardImmediate: safety timeout (20s) para board', boardId);
            const stuckBoard = stateRef.current.boards.find(b => b.id === boardId);
            activeSavesRef.current = Math.max(0, activeSavesRef.current - 1);
            if (activeSavesRef.current === 0) suppressRealtime(2000);
            dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId, saving: false } });
            // Mostra painel de erro com snapshot atual para retry/revert
            dispatch({
                type: 'PUSH_SAVE_ERROR',
                payload: {
                    boardId,
                    boardTitle: stuckBoard?.title,
                    boardSnapshot: stuckBoard ? JSON.parse(JSON.stringify(stuckBoard)) : null,
                    error: 'Timeout: save travou. Verifique sua conexão.',
                },
            });
        }, 20000);

        try {
            const freshUserId = await getFreshUserId();
            if (!freshUserId) {
                logger.warn('[AppContext] persistBoardImmediate: sem sessão, abortando');
                if (boardSnapshot) {
                    dispatch({ type: 'SET_BOARDS', payload: stateRef.current.boards.map(b => b.id === boardId ? boardSnapshot : b) });
                    dispatch({
                        type: 'PUSH_SAVE_ERROR',
                        payload: { boardId, boardTitle: boardSnapshot?.title, boardSnapshot, error: 'Sessão expirada' }
                    });
                }
                return;
            }
            const board = stateRef.current.boards.find(b => b.id === boardId);
            if (!board) return;
            const result = await updateBoardFull(freshUserId, { ...board, ...updates });
            if (!result?.success) throw new Error(result?.error || 'Falha ao salvar');
        } catch (err) {
            logger.error('[AppContext] persistBoardImmediate error:', err);
            if (boardSnapshot) {
                dispatch({ type: 'SET_BOARDS', payload: stateRef.current.boards.map(b => b.id === boardId ? boardSnapshot : b) });
                dispatch({
                    type: 'PUSH_SAVE_ERROR',
                    payload: { boardId, boardTitle: boardSnapshot?.title, boardSnapshot, error: err?.message || 'Falha ao salvar' }
                });
            }
        } finally {
            clearTimeout(safetyTimer);
            activeSavesRef.current = Math.max(0, activeSavesRef.current - 1);
            if (activeSavesRef.current === 0) suppressRealtime(2000);
            dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId, saving: false } });
        }
    }, [shouldPersistBoard, stateRef, dispatch, suppressRealtime, getFreshUserId]);

    // Atualiza board no estado e persiste IMEDIATAMENTE (usado para Drag & Drop e mudanças estruturais)
    const updateBoardAndPersistImmediate = useCallback(async (boardId, updates) => {
        if (!boardId || !userId) return;
        await persistBoardImmediate(boardId, updates);
    }, [userId, persistBoardImmediate]);

    // Atualiza board no estado e persiste no banco imediatamente (otimizado para board específico).
    const updateBoardAndPersist = useCallback(async (boardId, updates) => {
        if (!boardId || !userId) return;
        await persistBoardImmediate(boardId, updates);
    }, [userId, persistBoardImmediate]);

    // ── Retry / Revert save errors ──────────────────────────────────────────────────

    /**
     * Tenta salvar novamente um board que falhou.
     * Obtém sessão fresca (resolve token refresh) e persiste o estado atual do board.
     * Se funcionar, dismisses o erro do painel. Se falhar, mantém para o usuário tentar de novo.
     */
    const retryFailedSave = useCallback(async (boardId) => {
        if (!boardId || boardId === '__session__') {
            dispatch({ type: 'DISMISS_SAVE_ERROR', payload: boardId });
            return;
        }
        const board = stateRef.current.boards.find(b => b.id === boardId);
        if (!board || isBoardServerAuthoritative(boardId)) {
            // Sala ao vivo: o servidor collab já tem e persiste o estado atual.
            dispatch({ type: 'DISMISS_SAVE_ERROR', payload: boardId });
            return;
        }
        dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId, saving: true } });
        suppressRealtime(8000);
        activeSavesRef.current += 1;
        try {
            const freshUserId = await getFreshUserId();
            if (!freshUserId) {
                logger.warn('[AppContext] retryFailedSave: ainda sem sessão válida');
                return; // mantém o erro no painel
            }
            const result = await updateBoardFull(freshUserId, board);
            if (!result?.success) throw new Error(result?.error || 'Falha ao salvar');
            logger.debug('[AppContext] retryFailedSave OK:', board.title);
            dispatch({ type: 'DISMISS_SAVE_ERROR', payload: boardId });
        } catch (err) {
            logger.error('[AppContext] retryFailedSave error:', err);
            // Mantém o erro no painel; usuário pode tentar de novo ou reverter
        } finally {
            activeSavesRef.current = Math.max(0, activeSavesRef.current - 1);
            if (activeSavesRef.current === 0) suppressRealtime(500);
            dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId, saving: false } });
        }
    }, [stateRef, isBoardServerAuthoritative, dispatch, suppressRealtime, getFreshUserId]);

    /**
     * Descarta as alterações locais e recarrega a página para restaurar o estado
     * salvo no servidor. Garante reconexão limpa ao banco e token fresco.
     */
    const revertFailedSave = useCallback(async (boardId) => {
        dispatch({ type: 'DISMISS_SAVE_ERROR', payload: boardId });
        // Recarregar a página: token refreshed garantido, reconexão limpa ao banco,
        // estado recarregado do servidor sem risco de dados corrompidos localmente.
        window.location.reload();
    }, [dispatch]);

    return {
        saveTimeoutRef,
        saveInProgressRef,
        realtimeSuppressUntilRef,
        activeSavesRef,
        collabActiveBoardIdRef,
        collabConnectedRef,
        collabBoardRoomLiveRef,
        recentLocalEditsRef,
        markBoardLocalEdit,
        setCollabActiveBoardId,
        setCollabConnectedForBoard,
        setCollabBoardRoomLive,
        isBoardServerAuthoritative,
        suppressRealtime,
        getFreshUserId,
        shouldPersistBoard,
        executeBoardPersistNow,
        flushBoardPersist,
        waitForBoardSaves,
        persistBoard,
        saveAllPending,
        persistBoardImmediate,
        updateBoardAndPersistImmediate,
        updateBoardAndPersist,
        retryFailedSave,
        revertFailedSave,
    };
}
