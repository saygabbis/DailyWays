import {
  applyBoardAction,
  boardActionTargetId,
  normalizeBoardAction,
  sanitizeBoardAction,
} from '@dailyways/collab-protocol';

/**
 * Prepara a ação de board recebida: tira o que ela não pode mudar e completa ids/valores
 * (igual ao cliente). O servidor transmite a op JÁ preparada, então todos chegam no mesmo estado.
 */
export function prepareBoardOp(room, op) {
  if (op?.entity !== 'board' || op?.field !== 'action' || !op?.value?.type) return op;
  const value = normalizeBoardAction(sanitizeBoardAction(op.value), room?.board);
  return value === op.value ? op : { ...op, value };
}

export function applyBoardOpToRoom(room, op) {
  if (!room.board) return { ok: false, reason: 'Board not loaded' };

  const { type, field, value } = op;

  if (type === 'update' && field === 'action' && value?.type) {
    // Uma op na sala do board A não pode mexer no board B (nem no estado local de quem recebe).
    if (boardActionTargetId(value) !== room.board.id) {
      return { ok: false, reason: 'Board mismatch' };
    }
    room.board = applyBoardAction(room.board, value);
    room.dirty = true;
    room.revision += 1;
    return { ok: true };
  }

  return { ok: false, reason: 'Unsupported board op' };
}
