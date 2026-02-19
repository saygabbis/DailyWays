import { supabase } from './supabaseClient';

/**
 * Formato esperado de um board (como no AppContext):
 * { id, title, color, emoji, createdAt, lists: [ { id, title, cards: [ { id, title, description, labels, priority, dueDate, myDay, subtasks, createdAt } ] } ] }
 */

// ── Helpers: app → DB row ──────────────────────────────────────────

function listToRow(list, boardId, position) {
  return {
    id: list.id,
    board_id: boardId,
    title: list.title ?? 'Nova Lista',
    position,
    color: list.color ?? null,
    is_completion_list: list.isCompletionList ?? false,
  };
}

function cardToRow(card, listId, position = 0) {
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
    position,
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

// ── Helpers: DB row → app ──────────────────────────────────────────

function rowToList(row, cards = []) {
  return {
    id: row.id,
    title: row.title,
    color: row.color ?? null,
    isCompletionList: row.is_completion_list ?? false,
    cards,
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
    position: row.position ?? 0,
    createdAt: row.created_at,
    lists: [],
  };
}

// ── Detecta se coluna "position" existe na tabela cards ────────────
// Cacheamos para não bater na API toda vez.
let _cardsHasPosition = null;

async function cardsHasPositionColumn() {
  if (_cardsHasPosition !== null) return _cardsHasPosition;
  try {
    // Tenta buscar 0 rows ordenando por position.
    // Se a coluna não existir, o Supabase retorna erro 400/42703.
    const { error } = await supabase
      .from('cards')
      .select('id')
      .order('position', { ascending: true })
      .limit(0);
    _cardsHasPosition = !error;
  } catch {
    _cardsHasPosition = false;
  }
  if (!_cardsHasPosition) {
    console.warn(
      '[boardService] Coluna "position" não encontrada na tabela cards. ' +
      'Execute a migration 20250218160000_cards_position_and_rls_fix.sql no SQL Editor do Supabase.'
    );
  }
  return _cardsHasPosition;
}

// Prepara o row de card, removendo "position" se a coluna não existir
function cardToRowSafe(card, listId, position, hasPosition) {
  const row = cardToRow(card, listId, position);
  if (!hasPosition) delete row.position;
  return row;
}

// ── Fetch ──────────────────────────────────────────────────────────

/**
 * Busca todos os boards do usuário (owner ou member) com listas, cards e subtarefas.
 * Retorna { data, error }: em erro (sessão expirada, rede, etc.) error é preenchido e data é [];
 * assim o app não confunde "falha na API" com "usuário sem dados" e evita sobrescrever com boards padrão.
 */
export async function fetchBoards(userId) {
  if (!userId) return { data: [], error: null };

  const hasPosition = await cardsHasPositionColumn();

  const { data: owned, error: ownedErr } = await supabase
    .from('boards')
    .select('*')
    .eq('owner_id', userId)
    .order('position', { ascending: true });
  if (ownedErr) {
    console.error('[boardService] fetchBoards owned error', ownedErr);
    return { data: [], error: ownedErr.message || 'Erro ao carregar boards.' };
  }

  const { data: memberRows, error: memberErr } = await supabase
    .from('board_members')
    .select('board_id')
    .eq('user_id', userId);
  if (memberErr) {
    console.error('[boardService] fetchBoards memberRows error', memberErr);
  }

  const ownedIds = new Set((owned ?? []).map(b => b.id));
  const memberBoardIds = (memberRows ?? []).map(r => r.board_id).filter(id => !ownedIds.has(id));
  let boardsData = [...(owned ?? [])];
  if (memberBoardIds.length > 0) {
    const { data: shared, error: sharedErr } = await supabase
      .from('boards')
      .select('*')
      .in('id', memberBoardIds)
      .order('position', { ascending: true });
    if (!sharedErr && shared?.length) boardsData = boardsData.concat(shared);
  }

  if (!boardsData.length) return { data: [], error: null };

  const boardIds = boardsData.map(b => b.id);

  // ── Lists ──
  const { data: listsData, error: listsError } = await supabase
    .from('lists')
    .select('*')
    .in('board_id', boardIds)
    .order('position', { ascending: true });
  if (listsError) {
    console.error('[boardService] fetchBoards lists error', listsError);
    return { data: [], error: listsError.message || 'Erro ao carregar listas.' };
  }

  // ── Cards ──
  const listIds = (listsData ?? []).map(l => l.id);

  // Usa position se existir, senão created_at
  let cardsQuery = supabase.from('cards').select('*').in('list_id', listIds);
  if (hasPosition) {
    cardsQuery = cardsQuery.order('position', { ascending: true });
  } else {
    cardsQuery = cardsQuery.order('created_at', { ascending: true });
  }
  const { data: cardsData, error: cardsError } = await cardsQuery;
  if (cardsError) {
    console.error('[boardService] fetchBoards cards error', cardsError);
    return { data: [], error: cardsError.message || 'Erro ao carregar cards.' };
  }

  // ── Subtasks ──
  const cardIds = (cardsData ?? []).map(c => c.id);
  let subtasksData = [];
  if (cardIds.length > 0) {
    const { data: stData, error: stErr } = await supabase
      .from('subtasks')
      .select('*')
      .in('card_id', cardIds);
    if (stErr) {
      console.error('[boardService] fetchBoards subtasks error', stErr);
    }
    subtasksData = stData ?? [];
  }

  // ── Montar estrutura ──
  const subtasksByCard = {};
  subtasksData.forEach(s => {
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

  const data = boardsData.map(b => ({
    ...rowToBoard(b),
    lists: listsByBoard[b.id] ?? [],
  })).sort((a, b) => (a.position - b.position) || (new Date(a.createdAt) - new Date(b.createdAt)));

  console.log(`[boardService] fetchBoards OK: ${data.length} boards, ${(listsData ?? []).length} lists, ${(cardsData ?? []).length} cards, ${subtasksData.length} subtasks`);
  return { data, error: null };
}

// ── Delete ──────────────────────────────────────────────────────────

/**
 * Remove um board e seus dependentes (cascade no DB).
 */
export async function deleteBoard(boardId) {
  const { error } = await supabase.from('boards').delete().eq('id', boardId);
  if (error) console.error('[boardService] deleteBoard error', boardId, error);
  return { success: !error, error: error?.message };
}

// ── Insert ──────────────────────────────────────────────────────────

/**
 * Insere um board completo (board + board_members + lists + cards + subtasks).
 */
export async function insertBoardFull(userId, board) {
  const hasPosition = await cardsHasPositionColumn();
  const boardId = board.id;

  console.log(`[boardService] insertBoardFull: board "${board.title}" (${boardId}), ${(board.lists ?? []).length} lists`);

  const { error: boardErr } = await supabase.from('boards').insert({
    id: boardId,
    owner_id: userId,
    title: board.title ?? 'Novo Board',
    color: board.color ?? null,
    emoji: board.emoji ?? '📋',
    position: board.position ?? 0,
    created_at: board.createdAt ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (boardErr) {
    // Duplicate key = board já existe, tentar update
    if (boardErr.code === '23505') {
      console.warn('[boardService] insertBoardFull: board already exists, updating instead', boardId);
      return updateBoardFull(userId, board);
    }
    console.error('[boardService] insertBoardFull board error', boardErr);
    return { success: false, error: boardErr.message };
  }

  const { error: memberErr } = await supabase.from('board_members').insert({
    board_id: boardId,
    user_id: userId,
    role: 'owner',
  });
  if (memberErr && memberErr.code !== '23505') {
    console.error('[boardService] insertBoardFull member error', memberErr);
    return { success: false, error: memberErr.message };
  }

  const lists = board.lists ?? [];
  for (let i = 0; i < lists.length; i++) {
    const list = lists[i];
    const { error: listErr } = await supabase.from('lists').insert(listToRow(list, boardId, i));
    if (listErr) {
      console.error('[boardService] insertBoardFull list error', list.id, listErr);
      return { success: false, error: listErr.message };
    }

    const cards = list.cards ?? [];
    for (let ci = 0; ci < cards.length; ci++) {
      const card = cards[ci];
      const { error: cardErr } = await supabase.from('cards').insert(cardToRowSafe(card, list.id, ci, hasPosition));
      if (cardErr) {
        console.error('[boardService] insertBoardFull card error', card.id, cardErr);
        return { success: false, error: cardErr.message };
      }

      const subtasks = card.subtasks ?? [];
      for (const st of subtasks) {
        const { error: stErr } = await supabase.from('subtasks').insert(subtaskToRow(st, card.id));
        if (stErr) {
          console.error('[boardService] insertBoardFull subtask error', st.id, stErr);
          return { success: false, error: stErr.message };
        }
      }
    }
  }

  console.log(`[boardService] insertBoardFull OK: board "${board.title}"`);
  return { success: true };
}

/**
 * Atualiza um board de forma inteligente (Upsert + Diff).
 * Em vez de deletar tudo, identifica o que foi removido e atualiza o resto em batch.
 */
export async function updateBoardFull(userId, board) {
  const hasPosition = await cardsHasPositionColumn();
  const boardId = board.id;

  console.log(`[boardService] upsertBoardFull (Smart): board "${board.title}" (${boardId})`);

  try {
    // 1. Atualizar metadados do board (usamos upsert em vez de update para ser resiliente a boards novos)
    const { error: upErr } = await supabase
      .from('boards')
      .upsert({
        id: boardId,
        owner_id: userId,
        title: board.title,
        color: board.color,
        emoji: board.emoji,
        position: board.position ?? 0,
        updated_at: new Date().toISOString(),
      });

    if (upErr) throw upErr;

    // 2. Coletar IDs do payload para o Diff
    const payloadListIds = new Set();
    const payloadCardIds = new Set();
    const payloadSubtaskIds = new Set();

    const listsToUpsert = [];
    const cardsToUpsert = [];
    const subtasksToUpsert = [];

    (board.lists ?? []).forEach((list, li) => {
      payloadListIds.add(list.id);
      listsToUpsert.push(listToRow(list, boardId, li));

      (list.cards ?? []).forEach((card, ci) => {
        payloadCardIds.add(card.id);
        cardsToUpsert.push(cardToRowSafe(card, list.id, ci, hasPosition));

        (card.subtasks ?? []).forEach(st => {
          payloadSubtaskIds.add(st.id);
          subtasksToUpsert.push(subtaskToRow(st, card.id));
        });
      });
    });

    // 3. Identificar e deletar removidos (Sync reverso)
    // Deletar subtarefas órfãs
    if (payloadListIds.size > 0) {
      const { data: dbCards } = await supabase.from('cards').select('id').in('list_id', Array.from(payloadListIds));
      const allDbCardIds = (dbCards ?? []).map(c => c.id);
      if (allDbCardIds.length > 0) {
        const { data: dbSubtasks } = await supabase.from('subtasks').select('id').in('card_id', allDbCardIds);
        const subtasksToDelete = (dbSubtasks ?? []).filter(st => !payloadSubtaskIds.has(st.id)).map(st => st.id);
        if (subtasksToDelete.length > 0) {
          await supabase.from('subtasks').delete().in('id', subtasksToDelete);
        }
      }
    }

    // Deletar cards órfãos
    const { data: dbLists } = await supabase.from('lists').select('id').eq('board_id', boardId);
    const allDbListIds = (dbLists ?? []).map(l => l.id);
    if (allDbListIds.length > 0) {
      const { data: dbCardsForBoard } = await supabase.from('cards').select('id').in('list_id', allDbListIds);
      const cardsToDelete = (dbCardsForBoard ?? []).filter(c => !payloadCardIds.has(c.id)).map(c => c.id);
      if (cardsToDelete.length > 0) {
        await supabase.from('cards').delete().in('id', cardsToDelete);
      }

      // Deletar listas órfãs
      const listsToDelete = allDbListIds.filter(id => !payloadListIds.has(id));
      if (listsToDelete.length > 0) {
        await supabase.from('lists').delete().in('id', listsToDelete);
      }
    }

    // 4. Batch Upsert (Apenas 3 chamadas para tudo)
    if (listsToUpsert.length > 0) {
      const { error: lErr } = await supabase.from('lists').upsert(listsToUpsert);
      if (lErr) throw lErr;
    }

    if (cardsToUpsert.length > 0) {
      const { error: cErr } = await supabase.from('cards').upsert(cardsToUpsert);
      if (cErr) throw cErr;
    }

    if (subtasksToUpsert.length > 0) {
      const { error: sErr } = await supabase.from('subtasks').upsert(subtasksToUpsert);
      if (sErr) throw sErr;
    }

    console.log(`[boardService] upsertBoardFull OK: "${board.title}"`);
    return { success: true };
  } catch (err) {
    console.error('[boardService] updateBoardFull error:', err);
    return { success: false, error: err.message || String(err) };
  }
}

// ── Save All ────────────────────────────────────────────────────────

/**
 * Salva todo o estado de boards do usuário: substitui no servidor pelos boards passados.
 * Retorna { success, error } para permitir fallback/retry.
 */
export async function saveBoards(userId, boards) {
  if (!userId || !boards?.length) return { success: true };
  try {
    console.log(`[boardService] saveBoards: salvando ${boards.length} boards para user ${userId.slice(0, 8)}...`);
    const { data: current, error: fetchError } = await fetchBoards(userId);
    if (fetchError) {
      console.error('[boardService] saveBoards fetchBoards failed, aborting save', fetchError);
      return { success: false, error: fetchError };
    }
    const currentIds = new Set(current.map(b => b.id));
    const payloadIds = new Set(boards.map(b => b.id));

    // Deletar boards que não estão mais no payload
    for (const b of current) {
      if (!payloadIds.has(b.id)) {
        const dr = await deleteBoard(b.id);
        if (!dr.success) console.warn('[boardService] deleteBoard failed', b.id, dr.error);
      }
    }

    // Inserir/atualizar boards
    const results = [];
    for (let i = 0; i < boards.length; i++) {
      const board = boards[i];
      // If board has id from another user (not possible here but safety), we skip it? No.
      // We update/insert based on existing data.
      const { data: existing } = await supabase.from('boards').select('id').eq('id', board.id).single();
      if (existing) {
        const res = await updateBoardFull(userId, { ...board, position: i });
        results.push(res);
      } else {
        const res = await insertBoardFull(userId, { ...board, position: i });
        results.push(res);
      }
      if (!results[results.length - 1].success) {
        console.error('[boardService] saveBoards operation failed for board', board.id, results[results.length - 1].error);
        return results[results.length - 1];
      }
    }

    console.log('[boardService] saveBoards OK');
    return { success: true };
  } catch (err) {
    const msg = err?.message || String(err);
    console.error('[boardService] saveBoards uncaught error', msg);
    return { success: false, error: msg };
  }
}

/**
 * Atualiza apenas a ordem (position) de múltiplos boards.
 * payloads: array de { id, position }
 */
export async function updateBoardsOrder(userId, payloads) {
  if (!userId || !payloads?.length) return { success: true };

  console.log(`[boardService] updateBoardsOrder: atualizando ${payloads.length} boards...`);

  // Como o Supabase não tem bulk update amigável por ID sem RPC,
  // fazemos um loop ou usamos upsert se as colunas permitirem.
  // Para positions, o custo de loops é baixo (geralmente < 20 boards).
  const errors = [];
  for (const p of payloads) {
    const { error } = await supabase
      .from('boards')
      .update({ position: p.position, updated_at: new Date().toISOString() })
      .eq('id', p.id);
    if (error) errors.push(error);
  }

  if (errors.length) {
    console.error('[boardService] updateBoardsOrder errors:', errors);
    return { success: false, error: 'Erro ao salvar nova ordem dos boards.' };
  }

  return { success: true };
}
