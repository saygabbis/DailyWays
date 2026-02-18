import { supabase } from './supabaseClient';

/**
 * Formato esperado de um board (como no AppContext):
 * { id, title, color, emoji, createdAt, lists: [ { id, title, cards: [ { id, title, description, labels, priority, dueDate, myDay, subtasks, createdAt } ] } ] }
 */

function listToRow(list, boardId, position) {
  return {
    id: list.id,
    board_id: boardId,
    title: list.title ?? 'Nova Lista',
    position,
  };
}

function cardToRow(card, listId) {
  return {
    id: card.id,
    list_id: listId,
    title: card.title ?? 'Nova Tarefa',
    description: card.description ?? '',
    priority: card.priority ?? 'none',
    due_date: card.dueDate ?? null,
    my_day: card.myDay ?? false,
    labels: Array.isArray(card.labels) ? card.labels : [],
    created_at: card.createdAt ?? new Date().toISOString(),
  };
}

function subtaskToRow(st, cardId) {
  return {
    id: st.id,
    card_id: cardId,
    title: st.title ?? '',
    done: st.done ?? false,
  };
}

function rowToList(row, cards = []) {
  return {
    id: row.id,
    title: row.title,
    cards: cards.map(c => rowToCard(c)),
  };
}

function rowToCard(row, subtasks = []) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    labels: row.labels ?? [],
    priority: row.priority ?? 'none',
    dueDate: row.due_date ?? null,
    myDay: row.my_day ?? false,
    subtasks: subtasks.map(s => ({ id: s.id, title: s.title, done: s.done })),
    createdAt: row.created_at,
  };
}

function rowToBoard(row) {
  return {
    id: row.id,
    title: row.title,
    color: row.color,
    emoji: row.emoji,
    createdAt: row.created_at,
    lists: [],
  };
}

/**
 * Busca todos os boards do usuário (owner ou member) com listas, cards e subtarefas.
 */
export async function fetchBoards(userId) {
  if (!userId) return [];
  const { data: owned, error: ownedErr } = await supabase
    .from('boards')
    .select('*')
    .eq('owner_id', userId);
  if (ownedErr) {
    console.error('fetchBoards owned error', ownedErr);
    return [];
  }
  const { data: memberRows, error: memberErr } = await supabase
    .from('board_members')
    .select('board_id')
    .eq('user_id', userId);
  if (memberErr) {
    console.error('fetchBoards memberRows error', memberErr);
  }
  const ownedIds = new Set((owned ?? []).map(b => b.id));
  const memberBoardIds = (memberRows ?? []).map(r => r.board_id).filter(id => !ownedIds.has(id));
  let boardsData = [...(owned ?? [])];
  if (memberBoardIds.length > 0) {
    const { data: shared, error: sharedErr } = await supabase
      .from('boards')
      .select('*')
      .in('id', memberBoardIds);
    if (!sharedErr && shared?.length) boardsData = boardsData.concat(shared);
  }
  if (!boardsData.length) return [];
  const boardIds = boardsData.map(b => b.id);
  const { data: listsData, error: listsError } = await supabase
    .from('lists')
    .select('*')
    .in('board_id', boardIds)
    .order('position', { ascending: true });
  if (listsError) {
    console.error('fetchBoards lists error', listsError);
    return [];
  }
  const listIds = (listsData ?? []).map(l => l.id);
  const { data: cardsData, error: cardsError } = await supabase
    .from('cards')
    .select('*')
    .in('list_id', listIds)
    .order('created_at', { ascending: true });
  if (cardsError) {
    console.error('fetchBoards cards error', cardsError);
    return [];
  }
  const cardIds = (cardsData ?? []).map(c => c.id);
  const { data: subtasksData } = await supabase
    .from('subtasks')
    .select('*')
    .in('card_id', cardIds);
  const subtasksByCard = {};
  (subtasksData ?? []).forEach(s => {
    if (!subtasksByCard[s.card_id]) subtasksByCard[s.card_id] = [];
    subtasksByCard[s.card_id].push(s);
  });
  const cardsByList = {};
  (cardsData ?? []).forEach(c => {
    if (!cardsByList[c.list_id]) cardsByList[c.list_id] = [];
    cardsByList[c.list_id].push(rowToCard(c, subtasksByCard[c.id] ?? []));
  });
  const listsByBoard = {};
  (listsData ?? []).forEach(l => {
    if (!listsByBoard[l.board_id]) listsByBoard[l.board_id] = [];
    listsByBoard[l.board_id].push(rowToList(l, cardsByList[l.id] ?? []));
  });
  return boardsData.map(b => ({
    ...rowToBoard(b),
    lists: listsByBoard[b.id] ?? [],
  }));
}

/**
 * Remove um board e seus dependentes (cascade no DB).
 */
export async function deleteBoard(boardId) {
  const { error } = await supabase.from('boards').delete().eq('id', boardId);
  return { success: !error, error: error?.message };
}

/**
 * Insere um board completo (board + board_members + lists + cards + subtasks).
 */
export async function insertBoardFull(userId, board) {
  const boardId = board.id;
  const { error: boardErr } = await supabase.from('boards').insert({
    id: boardId,
    owner_id: userId,
    title: board.title ?? 'Novo Board',
    color: board.color ?? null,
    emoji: board.emoji ?? '📋',
    created_at: board.createdAt ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (boardErr) return { success: false, error: boardErr.message };
  const { error: memberErr } = await supabase.from('board_members').insert({
    board_id: boardId,
    user_id: userId,
    role: 'owner',
  });
  if (memberErr && memberErr.code !== '23505') return { success: false, error: memberErr.message };
  const lists = board.lists ?? [];
  for (let i = 0; i < lists.length; i++) {
    const list = lists[i];
    const { error: listErr } = await supabase.from('lists').insert(listToRow(list, boardId, i));
    if (listErr) return { success: false, error: listErr.message };
    const cards = list.cards ?? [];
    for (const card of cards) {
      const { error: cardErr } = await supabase.from('cards').insert(cardToRow(card, list.id));
      if (cardErr) return { success: false, error: cardErr.message };
      const subtasks = card.subtasks ?? [];
      for (const st of subtasks) {
        const { error: stErr } = await supabase.from('subtasks').insert(subtaskToRow(st, card.id));
        if (stErr) return { success: false, error: stErr.message };
      }
    }
  }
  return { success: true };
}

/**
 * Atualiza um board existente: atualiza metadados do board e sincroniza listas/cards/subtasks.
 * Estratégia: deletar listas atuais do board (cascade apaga cards e subtasks), depois inserir listas/cards/subtasks do payload.
 */
export async function updateBoardFull(userId, board) {
  const boardId = board.id;
  const { error: upErr } = await supabase
    .from('boards')
    .update({
      title: board.title,
      color: board.color,
      emoji: board.emoji,
      updated_at: new Date().toISOString(),
    })
    .eq('id', boardId)
    .eq('owner_id', userId);
  if (upErr) return { success: false, error: upErr.message };
  const { data: existingLists } = await supabase.from('lists').select('id').eq('board_id', boardId);
  for (const l of existingLists ?? []) {
    await supabase.from('lists').delete().eq('id', l.id);
  }
  const lists = board.lists ?? [];
  for (let i = 0; i < lists.length; i++) {
    const list = lists[i];
    const { error: listErr } = await supabase.from('lists').insert(listToRow(list, boardId, i));
    if (listErr) return { success: false, error: listErr.message };
    const cards = list.cards ?? [];
    for (const card of cards) {
      const { error: cardErr } = await supabase.from('cards').insert(cardToRow(card, list.id));
      if (cardErr) return { success: false, error: cardErr.message };
      const subtasks = card.subtasks ?? [];
      for (const st of subtasks) {
        const { error: stErr } = await supabase.from('subtasks').insert(subtaskToRow(st, card.id));
        if (stErr) return { success: false, error: stErr.message };
      }
    }
  }
  return { success: true };
}

/**
 * Salva todo o estado de boards do usuário: substitui no servidor pelos boards passados.
 * Retorna { success, error } para permitir fallback/retry.
 */
export async function saveBoards(userId, boards) {
  if (!userId || !boards?.length) return { success: true };
  try {
    const current = await fetchBoards(userId);
    const currentIds = new Set(current.map(b => b.id));
    const payloadIds = new Set(boards.map(b => b.id));
    for (const b of current) {
      if (!payloadIds.has(b.id)) {
        const dr = await deleteBoard(b.id);
        if (!dr.success) console.warn('[boardService] deleteBoard failed', b.id, dr.error);
      }
    }
    for (const board of boards) {
      if (currentIds.has(board.id)) {
        const res = await updateBoardFull(userId, board);
        if (!res.success) {
          console.error('[boardService] updateBoardFull failed', board.id, res.error);
          return res;
        }
      } else {
        const res = await insertBoardFull(userId, board);
        if (!res.success) {
          console.error('[boardService] insertBoardFull failed', board.id, res.error);
          return res;
        }
      }
    }
    return { success: true };
  } catch (err) {
    const msg = err?.message || String(err);
    console.error('[boardService] saveBoards error', msg);
    return { success: false, error: msg };
  }
}
