import { getUserDbClient } from '../db/supabase.js';

/** Board da sala → payload do `upsert_board_full` (formato camelCase esperado pela RPC). */
export function boardToRpcPayload(board) {
  const now = new Date().toISOString();
  return {
    id: board.id,
    title: board.title ?? 'Novo Board',
    color: board.color ?? null,
    emoji: board.emoji ?? '📋',
    position: board.position ?? 0,
    groupId: board.groupId ?? null,
    lists: (board.lists ?? []).map((list, listIndex) => ({
      id: list.id,
      title: list.title ?? 'Nova Lista',
      color: list.color ?? null,
      isCompletionList: list.isCompletionList ?? false,
      position: list.position ?? listIndex,
      cards: (list.cards ?? []).map((card, cardIndex) => ({
        id: card.id,
        position: card.position ?? cardIndex,
        title: card.title ?? 'Nova Tarefa',
        description: card.description ?? '',
        priority: card.priority ?? 'none',
        dueDate: card.dueDate ?? null,
        startDate: card.startDate ?? null,
        isAllDay: card.isAllDay ?? true,
        recurrenceRule: card.recurrenceRule ?? null,
        myDay: card.myDay ?? false,
        dayCategory: card.dayCategory ?? null,
        estimatedMinutes: card.estimatedMinutes ?? null,
        labels: Array.isArray(card.labels) ? card.labels : [],
        color: card.color ?? null,
        coverAttachmentId: card.coverAttachmentId ?? null,
        createdAt: card.createdAt ?? now,
        updatedAt: card.updatedAt ?? now,
        completed: card.completed ?? false,
        subtasks: (card.subtasks ?? []).map((st, index) => ({
          id: st.id,
          title: st.title ?? '',
          done: st.done ?? false,
          position: st.position ?? index,
          linkUrl: st.linkUrl ?? null,
          linkLabel: st.linkLabel ?? null,
          createdAt: st.createdAt ?? now,
          updatedAt: st.updatedAt ?? now,
        })),
      })),
    })),
  };
}

export async function flushBoard(room) {
  if (!room?.board || !room.dirty) return;

  const db = getUserDbClient(room.flushAccessToken);
  if (!db) {
    console.warn('[collab-server] flushBoard skipped: missing user access token (RLS)');
    return;
  }

  // Payload montado e sala marcada limpa ANTES do await: uma op que chegar durante a gravação
  // volta a sujar a sala e entra no próximo ciclo. Se a gravação falhar, a sala volta a ficar suja.
  const payload = boardToRpcPayload(room.board);
  room.dirty = false;
  try {
    const { data, error } = await db.rpc('upsert_board_full', { p_board: payload });
    if (error) throw error;
    const parsed = typeof data === 'object' && data !== null ? data : {};
    if (parsed.success === false) {
      throw new Error(parsed.error || 'upsert_board_full rejected');
    }
  } catch (err) {
    room.dirty = true;
    console.error('[collab-server] flushBoard error', err?.message || err);
    throw err;
  }
  room.loadedAt = Date.now();
}
