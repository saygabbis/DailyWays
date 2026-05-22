import { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useBoardCollabContext } from '../../collab/board/ops/BoardCollabContext.jsx';
import { isCollabEnabled } from '../../collab/core/collabConfig.js';
import { Cloud, CloudOff, Loader2, Radio } from 'lucide-react';
import './FloatingSaveButton.css';

/**
 * Status de persistência: Postgres direto e/ou sync collab (WebSocket).
 */
export default function FloatingSaveButton() {
  const {
    hasUnsavedChanges,
    saveAllPending,
    savingBoardIds,
    pendingBoardIds,
    state,
  } = useApp();
  const boardCollab = useBoardCollabContext();

  const isSaving = savingBoardIds.length > 0;
  const isPending = pendingBoardIds.length > 0;
  const collabOnActiveBoard = isCollabEnabled()
    && boardCollab?.connected
    && boardCollab?.activeBoardId
    && state.activeBoard === boardCollab.activeBoardId;

  const visible = hasUnsavedChanges || isSaving || isPending;

  const statusText = useMemo(() => {
    if (isSaving) {
      const realBoardIds = savingBoardIds.filter((id) => !id.startsWith('__'));
      if (realBoardIds.length === 1) {
        const board = state.boards.find((b) => b.id === realBoardIds[0]);
        if (collabOnActiveBoard && realBoardIds[0] === boardCollab.activeBoardId) {
          return board ? `Sincronizando: ${board.title}` : 'Sincronizando...';
        }
        return board ? `Salvando: ${board.title}` : 'Salvando...';
      }
      if (collabOnActiveBoard && savingBoardIds.includes(boardCollab.activeBoardId)) {
        return 'Sincronizando alterações...';
      }
      return `Salvando ${savingBoardIds.length} itens...`;
    }
    if (isPending) {
      if (collabOnActiveBoard) return 'Alterações aguardando sync';
      return 'Alterações não salvas';
    }
    return 'Alterações não salvas';
  }, [
    isSaving,
    isPending,
    savingBoardIds,
    state.boards,
    collabOnActiveBoard,
    boardCollab?.activeBoardId,
  ]);

  if (!visible) return null;

  const StatusIcon = isSaving
    ? Loader2
    : (collabOnActiveBoard ? Radio : CloudOff);

  return (
    <div className={`floating-save${isSaving ? ' floating-save--saving' : ''} animate-slide-up`}>
      <div className="floating-save-status">
        {isSaving
          ? <StatusIcon size={14} className="spinning" />
          : <StatusIcon size={14} />
        }
        <span>{statusText}</span>
      </div>
      {!isSaving && isPending && !collabOnActiveBoard && (
        <button
          className="floating-save-btn"
          onClick={saveAllPending}
          title="Salvar agora no servidor"
          type="button"
        >
          <Cloud size={14} />
          Salvar agora
        </button>
      )}
    </div>
  );
}
