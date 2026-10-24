
/** Conversão app ⇄ linhas do Postgres (boards, listas, cards, subtarefas) e helpers de dono/membros. */
// PostgreSQL integer max — subtask.position must stay within this range
export const PG_INT_MAX = 2147483647;

/** Normaliza position para colunas integer no Postgres (ex.: subtasks criadas com Date.now()). */
export function normalizePgIntPosition(value, fallbackIndex) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > PG_INT_MAX) return fallbackIndex;
  return Math.trunc(n);
}

export function listToRow(list, boardId, position) {
  return {
    id: list.id,
    board_id: boardId,
    title: list.title ?? 'Nova Lista',
    position,
    color: list.color ?? null,
    is_completion_list: list.isCompletionList ?? false,
  };
}

export function cardToRow(card, listId, position = 0) {
  return {
    id: card.id,
    list_id: listId,
    title: card.title ?? 'Nova Tarefa',
    description: card.description ?? '',
    priority: card.priority ?? 'none',
    due_date: card.dueDate ?? null,
    start_date: card.startDate ?? null,
    is_all_day: card.isAllDay ?? true,
    recurrence_rule: card.recurrenceRule ?? null,
    my_day: card.myDay ?? false,
    day_category: card.dayCategory ?? null,
    estimated_minutes: card.estimatedMinutes ?? null,
    labels: Array.isArray(card.labels) ? card.labels : [],
    color: card.color ?? null,
    cover_attachment_id: card.coverAttachmentId ?? null,
    created_at: card.createdAt ?? new Date().toISOString(),
    updated_at: card.updatedAt ?? new Date().toISOString(),
    completed: card.completed ?? false,
    position,
  };
}

export function subtaskToRow(st, cardId, position = 0) {
  return {
    id: st.id,
    card_id: cardId,
    title: st.title ?? '',
    done: st.done ?? false,
    position: normalizePgIntPosition(st.position, position),
    link_url: st.linkUrl ?? null,
    link_label: st.linkLabel ?? null,
    created_at: st.createdAt ?? new Date().toISOString(),
    updated_at: st.updatedAt ?? new Date().toISOString(),
  };
}

export function rowToList(row, cards = []) {
  return {
    id: row.id,
    title: row.title,
    color: row.color ?? null,
    isCompletionList: row.is_completion_list ?? false,
    cards,
  };
}

export function rowToCard(row, subtasks = []) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    labels: row.labels ?? [],
    priority: row.priority ?? 'none',
    dueDate: row.due_date ?? null,
    startDate: row.start_date ?? null,
    isAllDay: row.is_all_day ?? true,
    recurrenceRule: row.recurrence_rule ?? null,
    myDay: row.my_day ?? false,
    dayCategory: row.day_category ?? null,
    estimatedMinutes: row.estimated_minutes ?? null,
    color: row.color ?? null,
    coverAttachmentId: row.cover_attachment_id ?? null,
    subtasks: subtasks.map(s => ({
      id: s.id,
      title: s.title,
      done: s.done,
      position: s.position ?? 0,
      linkUrl: s.link_url ?? null,
      linkLabel: s.link_label ?? null,
      createdAt: s.created_at ?? null,
      updatedAt: s.updated_at ?? null,
    })),
    completed: row.completed ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
  };
}

export function rowToBoard(row) {
  return {
    id: row.id,
    title: row.title,
    color: row.color,
    emoji: row.emoji,
    position: row.position ?? 0,
    groupId: row.group_id ?? null,
    ownerId: row.owner_id ?? null,
    createdAt: row.created_at,
    lists: [],
  };
}

/** Dono do board no cliente: requer ownerId vindo do servidor (evita confundir membro com dono). */
export function isBoardOwnerClient(board, userId) {
  if (!userId || !board) return false;
  return board.ownerId === userId;
}

/** Membros para UI: dono do board sempre primeiro (`role === 'owner'` ou `userId === ownerId`). */
export function sortBoardMembersOwnerFirst(members, ownerId) {
  if (!Array.isArray(members)) return [];
  return [...members].sort((a, b) => {
    const aIsOwner = a.role === 'owner' || (ownerId && a.userId === ownerId);
    const bIsOwner = b.role === 'owner' || (ownerId && b.userId === ownerId);
    if (aIsOwner && !bIsOwner) return -1;
    if (!aIsOwner && bIsOwner) return 1;
    return 0;
  });
}
