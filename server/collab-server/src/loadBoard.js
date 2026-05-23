import { getDbClient } from './supabase.js';

function mapBoard(row, lists, cardsByList, subtasksByCard) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    color: row.color,
    emoji: row.emoji,
    groupId: row.group_id,
    position: row.position ?? 0,
    createdAt: row.created_at,
    lists: lists.map((l, listIndex) => ({
      id: l.id,
      title: l.title,
      color: l.color,
      isCompletionList: l.is_completion_list ?? false,
      position: l.position ?? listIndex,
      cards: (cardsByList.get(l.id) || []).map((c, cardIndex) => ({
        id: c.id,
        position: c.position ?? cardIndex,
        title: c.title,
        description: c.description ?? '',
        labels: c.labels ?? [],
        priority: c.priority ?? 'none',
        dueDate: c.due_date,
        startDate: c.start_date,
        isAllDay: c.is_all_day ?? true,
        recurrenceRule: c.recurrence_rule,
        myDay: c.my_day ?? false,
        color: c.color,
        coverAttachmentId: c.cover_attachment_id,
        completed: c.completed ?? false,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        subtasks: (subtasksByCard.get(c.id) || []).map((st) => ({
          id: st.id,
          title: st.title,
          done: st.done,
          position: st.position,
          linkUrl: st.link_url,
          linkLabel: st.link_label,
          createdAt: st.created_at,
          updatedAt: st.updated_at,
        })),
      })),
    })),
  };
}

export async function loadBoardFromDb(boardId, accessToken) {
  const db = getDbClient(accessToken);
  if (!db || !boardId) {
    return { board: null, revision: 0 };
  }

  const { data: boardRow, error: boardErr } = await db
    .from('boards')
    .select('id, title, color, emoji, position, group_id, owner_id, created_at')
    .eq('id', boardId)
    .maybeSingle();

  // #region agent log
  try {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const logPath = path.resolve(
      fileURLToPath(import.meta.url),
      '../../../debug-64ad20.log',
    );
    fs.appendFileSync(
      logPath,
      `${JSON.stringify({
        sessionId: '64ad20',
        timestamp: Date.now(),
        hypothesisId: 'H6',
        location: 'loadBoard.js:loadBoardFromDb',
        message: 'board query',
        data: {
          boardIdPrefix: boardId?.slice(0, 8),
          hasRow: Boolean(boardRow),
          errCode: boardErr?.code ?? null,
          errMsg: boardErr?.message?.slice(0, 80) ?? null,
        },
      })}\n`,
    );
  } catch {
    /* ignore */
  }
  // #endregion

  if (boardErr || !boardRow) {
    return { board: null, revision: 0 };
  }

  const { data: listsData } = await db
    .from('lists')
    .select('id, board_id, title, color, position, is_completion_list')
    .eq('board_id', boardId)
    .order('position', { ascending: true });

  const listIds = (listsData || []).map((l) => l.id);
  let cardsData = [];
  if (listIds.length) {
    const { data: cards } = await db
      .from('cards')
      .select('id, list_id, title, description, priority, due_date, start_date, is_all_day, recurrence_rule, my_day, labels, color, cover_attachment_id, created_at, updated_at, completed, position')
      .in('list_id', listIds)
      .order('position', { ascending: true });
    cardsData = cards || [];
  }

  const cardIds = cardsData.map((c) => c.id);
  let subtasksData = [];
  if (cardIds.length) {
    const { data: st } = await db
      .from('subtasks')
      .select('id, card_id, title, done, position, link_url, link_label, created_at, updated_at')
      .in('card_id', cardIds);
    subtasksData = st || [];
  }

  const cardsByList = new Map();
  for (const c of cardsData) {
    if (!cardsByList.has(c.list_id)) cardsByList.set(c.list_id, []);
    cardsByList.get(c.list_id).push(c);
  }
  const subtasksByCard = new Map();
  for (const st of subtasksData) {
    if (!subtasksByCard.has(st.card_id)) subtasksByCard.set(st.card_id, []);
    subtasksByCard.get(st.card_id).push(st);
  }

  return {
    board: mapBoard(boardRow, listsData || [], cardsByList, subtasksByCard),
    revision: 0,
  };
}
