import { applyBoardAction } from '@dailyways/collab-protocol';

export function applyBoardOpToRoom(room, op) {
  if (!room.board) return { ok: false, reason: 'Board not loaded' };

  const { type, field, value } = op;

  if (type === 'update' && field === 'action' && value?.type) {
    room.board = applyBoardAction(room.board, value);
    room.dirty = true;
    room.revision += 1;
    return { ok: true };
  }

  return { ok: false, reason: 'Unsupported board op' };
}
