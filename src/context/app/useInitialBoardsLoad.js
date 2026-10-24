/**
 * Carga inicial (boards, grupos, spaces) ao logar; limpeza total ao deslogar.
 * Erro de rede/sessão NUNCA cria boards padrão — só usuário novo (API ok + lista vazia).
 */
import { useEffect, useRef } from 'react';
import { fetchBoards, saveBoards } from '../../services/boardService';
import { fetchGroups, fetchSpaces } from '../../services/workspaceService';
import storageService, { STORAGE_KEYS } from '../../services/storageService';
import { logger } from '../../utils/logger';
import { createDefaultBoards } from './appDefaults';

export function useInitialBoardsLoad({ userId, dispatch, initialLoadDone, saveTimeoutRef, activeSavesRef, realtimeSuppressUntilRef }) {
    const loadInProgressRef = useRef(false);

    // Load boards: Supabase primeiro. Se der ERRO (sessão expirada, rede), NUNCA criar defaults:
    // usar localStorage como fallback e retentar a API depois. Só criar boards padrão quando a API
    // retornar sucesso com lista vazia (usuário novo).
    // IMPORTANTE: depende de [userId] (primitivo), NÃO de [user] (objeto),
    // para evitar re-execução quando refreshUser cria novo objeto com mesmo ID.
    useEffect(() => {
        if (!userId) {
            // Logout: limpar tudo para evitar race conditions no próximo login
            initialLoadDone.current = false;
            loadInProgressRef.current = false;
            // Cancelar qualquer persistência pendente
            Object.values(saveTimeoutRef.current || {}).forEach((timeoutId) => clearTimeout(timeoutId));
            saveTimeoutRef.current = {};
            // Resetar contador de saves ativos e supressão de Realtime
            activeSavesRef.current = 0;
            realtimeSuppressUntilRef.current = 0;
            dispatch({ type: 'SET_BOARDS', payload: [] });
            dispatch({ type: 'SET_GROUPS', payload: [] });
            dispatch({ type: 'SET_SPACES', payload: [] });
            dispatch({ type: 'CLEAR_SELECTION' });
            dispatch({ type: 'SET_ACTIVE_BOARD', payload: null });
            // Limpar listas de pendências, saves e erros ao sair
            dispatch({ type: 'SET_PENDING_BOARD', payload: { boardId: '__all__', pending: false } });
            dispatch({ type: 'CLEAR_SAVING' });
            dispatch({ type: 'CLEAR_SAVE_ERRORS' });
            dispatch({ type: 'SET_BOARDS_LOAD_ERROR', payload: null });
            logger.debug('[AppContext] User logout: state cleared');
            return;
        }
        if (loadInProgressRef.current) {
            logger.debug('[AppContext] Load already in progress, skipping');
            return;
        }
        loadInProgressRef.current = true;
        let cancelled = false;

        const applyBoards = (boards, source) => {
            if (!cancelled && boards?.length > 0) {
                logger.debug(`[AppContext] applyBoards (${source}): ${boards.length} boards`);
                dispatch({ type: 'SET_BOARDS', payload: boards });

                // Restaurar último board ativo (apenas preferência de UI, não dados)
                const lastActive = storageService.load(STORAGE_KEYS.ACTIVE_BOARD);
                const activeId = lastActive && boards.find((b) => b.id === lastActive)
                    ? lastActive
                    : null;

                if (activeId) {
                    dispatch({ type: 'SET_ACTIVE_BOARD', payload: activeId });
                }
                // Sem localStorage para boards — fonte de verdade é 100% o servidor
            }
        };

        const loadFromApi = async (isRetry = false) => {
            logger.debug(`[AppContext] loadFromApi (retry=${isRetry}) for user ${userId.slice(0, 8)}...`);
            const { data: fromDb, error: fetchError } = await fetchBoards(userId);
            const { data: dbGroups, error: groupErr } = await fetchGroups(userId);
            const { data: dbSpaces, error: spaceErr } = await fetchSpaces(userId);

            if (cancelled) return { ok: false };
            if (fetchError || groupErr || spaceErr) {
                logger.error('[AppContext] fetch error:', fetchError || groupErr || spaceErr);
                dispatch({ type: 'SET_BOARDS_LOAD_ERROR', payload: fetchError || groupErr || spaceErr || null });
                // Erro de rede/sessão: boards ficam como estão na memória.
                // Retry automático após 2s na primeira falha.
                if (!isRetry) {
                    setTimeout(() => loadFromApi(true), 2000);
                }
                return { ok: false };
            }

            dispatch({ type: 'SET_BOARDS_LOAD_ERROR', payload: null });
            dispatch({ type: 'SET_GROUPS', payload: dbGroups || [] });
            dispatch({ type: 'SET_SPACES', payload: dbSpaces || [] });

            if (fromDb.length > 0) {
                applyBoards(fromDb, 'supabase');
                return { ok: true };
            }
            // Supabase retornou sucesso com 0 boards = usuário novo (confirmado pelo fetchBoards + RPC). Criar defaults.
            logger.debug('[AppContext] Nenhum board no Supabase, criando defaults...');
            const defaults = createDefaultBoards();
            dispatch({ type: 'SET_BOARDS', payload: defaults });
            dispatch({ type: 'SET_ACTIVE_BOARD', payload: defaults[0].id });
            await saveBoards(userId, defaults);
            return { ok: true };
        };

        (async () => {
            try {
                await loadFromApi(false);
                if (!cancelled) {
                    initialLoadDone.current = true;
                    logger.debug('[AppContext] Initial load done');
                }
            } catch (err) {
                logger.error('[AppContext] loadFromApi uncaught error:', err);
            } finally {
                loadInProgressRef.current = false;
            }
        })();
        return () => { cancelled = true; };
        // Só userId dispara: o resto são refs/dispatch (identidade estável).
    }, [userId, dispatch, initialLoadDone, saveTimeoutRef, activeSavesRef, realtimeSuppressUntilRef]);
}
