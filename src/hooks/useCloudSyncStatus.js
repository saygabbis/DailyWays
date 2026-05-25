import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useBoardCollabContext } from '../collab/board/ops/BoardCollabContext.jsx';
import { isCollabEnabled } from '../collab/core/collabConfig.js';

/** Estado compacto da persistência (nuvem / Supabase). */
export function useCloudSyncStatus() {
  const {
    savingBoardIds,
    pendingBoardIds,
    saveErrors,
    state,
    saveAllPending,
  } = useApp();
  const boardCollab = useBoardCollabContext();

  const isSaving = savingBoardIds.length > 0;
  const isPending = pendingBoardIds.length > 0;
  const lastError = saveErrors[saveErrors.length - 1] ?? null;
  const collabOnActiveBoard = isCollabEnabled()
    && boardCollab?.connected
    && boardCollab?.activeBoardId
    && state.activeBoard === boardCollab.activeBoardId;

  const status = useMemo(() => {
    if (lastError) return 'error';
    if (isSaving) return 'saving';
    if (isPending) return 'pending';
    return 'synced';
  }, [lastError, isSaving, isPending]);

  const tooltip = useMemo(() => {
    if (status === 'error') {
      return lastError?.message || 'Falha ao guardar na nuvem. Clica para tentar de novo.';
    }
    if (status === 'saving') {
      if (collabOnActiveBoard) return 'A sincronizar alterações com a nuvem…';
      const realIds = savingBoardIds.filter((id) => !id.startsWith('__'));
      if (realIds.length === 1) {
        const board = state.boards.find((b) => b.id === realIds[0]);
        return board ? `A guardar «${board.title}» na nuvem…` : 'A guardar na nuvem…';
      }
      return 'A guardar na nuvem…';
    }
    if (status === 'pending') {
      if (collabOnActiveBoard) return 'Alterações em fila — sync em breve';
      return 'Alterações locais — ainda não guardadas na nuvem';
    }
    return 'Guardado na nuvem. Clica na nuvem para sincronizar manualmente.';
  }, [status, lastError, collabOnActiveBoard, savingBoardIds, state.boards]);

  return {
    status,
    tooltip,
    lastError,
    isSaving,
    isPending,
    collabOnActiveBoard,
    saveAllPending,
  };
}
