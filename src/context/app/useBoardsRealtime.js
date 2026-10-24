/**
 * Realtime do Supabase (postgres_changes) para sincronizar boards entre abas/usuários.
 * Ignora o eco das próprias gravações e, com a sala de collab ao vivo, o eco de lists/cards/subtasks.
 */
import { useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { fetchBoards } from '../../services/boardService';
import { logger } from '../../utils/logger';
import { isCollabEnabled } from '../../collab/core/collabConfig.js';

/** Janela em que uma edição local ainda pode não ter chegado ao banco (flush do collab ~600 ms). */
const LOCAL_EDIT_GRACE_MS = 4000;

export function useBoardsRealtime({ userId, dispatch, stateRef, initialLoadDone, activeSavesRef, realtimeSuppressUntilRef, collabActiveBoardIdRef, collabConnectedRef, collabBoardRoomLiveRef, recentLocalEditsRef }) {
    // ── Realtime: subscribe to postgres_changes for cross-tab / multi-user sync ──
    useEffect(() => {
        if (!userId) return;
        // Only subscribe after the initial load is done to avoid duplicate SET_BOARDS
        // We poll until initialLoadDone.current is true (it's a ref, so not tracked by React)
        let cancelled = false;
        let realtimeChannel = null;
        let debounceTimer = null;

        const waitAndSubscribe = () => {
            if (activeSavesRef.current > 0) {
                setTimeout(waitAndSubscribe, 200);
                return;
            }

            if (!initialLoadDone.current) {
                // Initial load not done yet — retry in 200ms
                setTimeout(waitAndSubscribe, 200);
                return;
            }

            const handleChange = (payload) => {
                const table = payload?.table;
                const collabEchoOnLiveBoard =
                    isCollabEnabled()
                    && collabActiveBoardIdRef.current
                    && collabConnectedRef.current
                    && collabBoardRoomLiveRef.current;

                if (
                    collabEchoOnLiveBoard
                    && ['lists', 'cards', 'subtasks'].includes(table)
                ) {
                    return;
                }

                // If THIS tab triggered this write, skip the echo to avoid overwriting
                // optimistic local state with potentially stale server data.
                const now = Date.now();
                const suppressedByWindow = now < realtimeSuppressUntilRef.current;
                const suppressedByActiveSaves = activeSavesRef.current > 0;

                if (suppressedByWindow || suppressedByActiveSaves) {
                    return;
                }

                if (debounceTimer) clearTimeout(debounceTimer);
                // Realtime: refetch curto para melhorar sensação de "instantâneo"
                const refetch = async () => {
                    if (cancelled) return;
                    logger.debug('[AppContext] Realtime refetch for user', userId.slice(0, 8));

                    const { data, error } = await fetchBoards(userId);

                    if (cancelled || error) {
                        return;
                    }
                    const activeId = collabActiveBoardIdRef.current;
                    const collabLive =
                        isCollabEnabled()
                        && activeId
                        && collabConnectedRef.current;
                    const now = Date.now();
                    const recent = recentLocalEditsRef?.current ?? new Map();
                    const keepLocal = (boardId) => (
                        (collabLive && boardId === activeId)
                        || now - (recent.get(boardId) ?? 0) < LOCAL_EDIT_GRACE_MS
                    );
                    const localById = new Map(stateRef.current.boards.map((b) => [b.id, b]));
                    let keptRecent = false;
                    const merged = data.map((b) => {
                        const local = localById.get(b.id);
                        if (!local || !keepLocal(b.id)) return b;
                        if (b.id !== activeId) keptRecent = true;
                        return local;
                    });
                    dispatch({ type: 'SET_BOARDS', payload: merged });
                    // Manteve versão local de board recém-editado: confere de novo quando o banco alcançar.
                    if (keptRecent && !cancelled) {
                        if (debounceTimer) clearTimeout(debounceTimer);
                        debounceTimer = setTimeout(refetch, LOCAL_EDIT_GRACE_MS);
                    }
                };
                debounceTimer = setTimeout(refetch, 250);
            };

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
