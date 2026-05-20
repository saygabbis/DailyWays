import { supabaseAdmin } from './supabase.js';

export async function flushBoard(room) {
  if (!supabaseAdmin || !room?.board || !room.dirty) return;
  const board = room.board;
  const userId = board.ownerId;
  if (!userId) return;

  const { data, error } = await supabaseAdmin.rpc('upsert_board_full', {
    p_board: {
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
          labels: Array.isArray(card.labels) ? card.labels : [],
          color: card.color ?? null,
          coverAttachmentId: card.coverAttachmentId ?? null,
          createdAt: card.createdAt ?? new Date().toISOString(),
          updatedAt: card.updatedAt ?? new Date().toISOString(),
          completed: card.completed ?? false,
          subtasks: (card.subtasks ?? []).map((st, index) => ({
            id: st.id,
            title: st.title ?? '',
            done: st.done ?? false,
            position: st.position ?? index,
            linkUrl: st.linkUrl ?? null,
            linkLabel: st.linkLabel ?? null,
            createdAt: st.createdAt ?? new Date().toISOString(),
            updatedAt: st.updatedAt ?? new Date().toISOString(),
          })),
        })),
      })),
    },
  });

  if (error) {
    console.error('[collab-server] flushBoard RPC error', error);
    return;
  }
  room.dirty = false;
}
