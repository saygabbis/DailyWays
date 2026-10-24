import { useEffect } from 'react';
import { useApp } from '../../../context/useApp';
import { useCollab } from '../../core/useCollab';
import { SERVER_EVENTS, boardActionTargetId } from '@dailyways/collab-protocol';
import { notifyRemoteBoardAction } from '../ui/boardRemoteAnim.js';
import { isOwnOp } from '../../core/collabClient.js';
import { boardOutbox } from '../ops/boardOutboxInstance.js';

/**
 * Aplica no AppContext as ops de board que o servidor collab confirmou (op:applied), na ordem
 * do servidor. Com ações locais ainda pendentes, refaz a tela como confirmado + pendentes, para
 * a edição local não ser "desfeita" por uma op remota mais antiga.
 */
export default function BoardCollabBridge() {
  const { dispatch } = useApp();
  const collab = useCollab();

  useEffect(() => {
    const socket = collab?.socket;
    if (!socket) return undefined;

    const onApplied = (payload) => {
      const op = payload?.op;
      if (op?.entity !== 'board' || op?.field !== 'action' || !op?.value?.type) return;
      const boardId = boardActionTargetId(op.value);
      if (!boardId || boardId !== op.id) return;
      const opId = payload.opId ?? op.opId;
      const { board, own } = boardOutbox.applyServerOp(boardId, opId, op.value);
      // Eco da PRÓPRIA aba: já está na tela. Outra aba do mesmo usuário recebe normalmente.
      if (own || isOwnOp(opId)) return;
      if (board) {
        dispatch({
          type: 'UPDATE_BOARD',
          payload: { id: boardId, updates: { lists: board.lists, title: board.title, color: board.color, emoji: board.emoji } },
        });
      } else {
        dispatch(op.value);
      }
      notifyRemoteBoardAction(op.value);
    };

    socket.on(SERVER_EVENTS.APPLIED, onApplied);
    return () => {
      socket.off(SERVER_EVENTS.APPLIED, onApplied);
    };
  }, [collab?.socket, dispatch]);

  return null;
}
