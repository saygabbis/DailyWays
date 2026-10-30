/**
 * Realtime do Supabase (postgres_changes) para sincronizar boards entre abas/usuários.
 *
 * Cada evento recarrega SÓ o board afetado (antes: todos os boards do usuário a cada linha
 * alterada — com o save tocando centenas de linhas, era o "engarrafamento"). O board com a sala
 * de collab ao vivo é ignorado: o servidor collab já entrega as ops dele em tempo real.
 */
import { useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { fetchBoard, fetchBoards } from '../../services/boardService';
import { logger } from '../../utils/logger';
import { isCollabEnabled } from '../../collab/core/collabConfig.js';
import { resolveRealtimeBoardId } from './realtimeBoardTarget.js';

/** Janela em que uma edição local ainda pode não ter chegado ao banco (flush do collab ~600 ms). */
const LOCAL_EDIT_GRACE_MS = 4000;
const DEBOUNCE_MS = 250;
/**
 * Board aberto com a sala caída/entrando: o join seguinte traz o estado do servidor, que é mais novo
 * que o banco (o flush vem depois). Recarregar do banco aqui fazia a tela voltar para trás.
 * Se o collab ficar fora por mais que isso, volta a usar o banco (o navegador grava no fallback).
 */
const ROOM_HOLD_RETRY_MS = 3000;
const ROOM_HOLD_MAX_MS = 20000;
const FULL = '__all__';

export function useBoardsRealtime({ userId, dispatch, stateRef, initialLoadDone, activeSavesRef, realtimeSuppressUntilRef, collabActiveBoardIdRef, collabConnectedRef, collabBoardRoomLiveRef, recentLocalEditsRef }) {
    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        let realtimeChannel = null;
        let debounceTimer = null;
        const dirty = new Set();
        let heldSince = 0;

        const isLiveRoom = (boardId) => (
            isCollabEnabled()
            && boardId
            && boardId === collabActiveBoardIdRef.current
            && collabConnectedRef.current
            && collabBoardRoomLiveRef.current
        );
        /** Board aberto no collab, mas a sala ainda não está ao vivo (reconectando/entrando). */
        const holdForRoom = (boardId) => {
            if (!isCollabEnabled() || !boardId || boardId !== collabActiveBoardIdRef.current) return false;
            if (isLiveRoom(boardId)) {
                heldSince = 0;
                return false;
            }
            if (!heldSince) heldSince = Date.now();
            return Date.now() - heldSince < ROOM_HOLD_MAX_MS;
        };
        const editedRecently = (boardId) => (
            Date.now() - (recentLocalEditsRef?.current?.get(boardId) ?? 0) < LOCAL_EDIT_GRACE_MS
        );

        const schedule = (delay = DEBOUNCE_MS) => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(run, delay);
        };

        const replaceBoard = (board, boardId) => {
            if (board) {
                dispatch({ type: 'REPLACE_BOARD_FROM_SERVER', payload: board });
            } else if (stateRef.current.boards.some((b) => b.id === boardId)) {
                // Apagado ou o acesso foi removido.
                dispatch({ type: 'DELETE_BOARD', payload: boardId });
            }
        };

        async function run() {
            if (cancelled || !dirty.size) return;
            // Save do próprio navegador em andamento: espera terminar (o eco dele chega depois).
            if (activeSavesRef.current > 0 || Date.now() < realtimeSuppressUntilRef.current) {
                schedule(Math.max(DEBOUNCE_MS, realtimeSuppressUntilRef.current - Date.now()));
                return;
            }
            const ids = [...dirty];
            dirty.clear();

            if (ids.includes(FULL)) {
                logger.debug('[realtime] refetch completo');
                const { data, error } = await fetchBoards(userId);
                if (cancelled || error) return;
                const localById = new Map(stateRef.current.boards.map((b) => [b.id, b]));
                let keptRecent = false;
                const merged = data.map((b) => {
                    const local = localById.get(b.id);
                    if (!local) return b;
                    if (isLiveRoom(b.id)) return local;
                    if (editedRecently(b.id) || holdForRoom(b.id)) {
                        keptRecent = true;
                        dirty.add(b.id);
                        return local;
                    }
                    return b;
                });
                dispatch({ type: 'SET_BOARDS', payload: merged });
                if (keptRecent) schedule(LOCAL_EDIT_GRACE_MS);
                return;
            }

            let held = false;
            for (const boardId of ids) {
                if (cancelled) return;
                if (isLiveRoom(boardId)) continue;
                // Edição local ainda chegando ao banco: confere de novo quando o banco alcançar.
                if (editedRecently(boardId)) {
                    dirty.add(boardId);
                    continue;
                }
                if (holdForRoom(boardId)) {
                    dirty.add(boardId);
                    held = true;
                    continue;
                }
                const { data, error } = await fetchBoard(boardId);
                if (cancelled || error) continue;
                if (isLiveRoom(boardId)) continue;
                if (editedRecently(boardId) || holdForRoom(boardId)) {
                    dirty.add(boardId);
                    continue;
                }
                replaceBoard(data, boardId);
            }
            if (dirty.size) schedule(held ? ROOM_HOLD_RETRY_MS : LOCAL_EDIT_GRACE_MS);
        }

        const handleChange = (payload) => {
            const target = resolveRealtimeBoardId(payload, stateRef.current.boards);
            if (target && target !== FULL && isLiveRoom(target)) return;
            dirty.add(target || FULL);
            schedule();
        };

        const waitAndSubscribe = () => {
            if (cancelled) return;
            if (activeSavesRef.current > 0 || !initialLoadDone.current) {
                setTimeout(waitAndSubscribe, 200);
                return;
            }
            realtimeChannel = supabase
                .channel('dailyways-sync-' + userId.slice(0, 8))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'boards' }, handleChange)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'board_members' }, handleChange)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'board_invitations' }, handleChange)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'lists' }, handleChange)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, handleChange)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'subtasks' }, handleChange)
                .subscribe();
        };

        waitAndSubscribe();

        return () => {
            cancelled = true;
            if (debounceTimer) clearTimeout(debounceTimer);
            if (realtimeChannel) {
                supabase.removeChannel(realtimeChannel);
            }
        };
    }, [userId, dispatch, stateRef, initialLoadDone, activeSavesRef, realtimeSuppressUntilRef, collabActiveBoardIdRef, collabConnectedRef, collabBoardRoomLiveRef, recentLocalEditsRef]);
}
