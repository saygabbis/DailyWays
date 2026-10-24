import { supabase } from './supabaseClient';
import {
    normalizePgIntPosition,
    listToRow,
    cardToRow,
    subtaskToRow,
    rowToList,
    rowToCard,
    rowToBoard,
} from './boardMappers';

/**
 * Formato esperado de um board (como no AppContext):
 * {
 *   id, title, color, emoji, createdAt,
 *   lists: [
 *     {
 *       id, title,
 *       cards: [
 *         {
 *           id, title, description, labels, priority,
 *           dueDate, startDate, isAllDay, recurrenceRule,
 *           coverAttachmentId, myDay, subtasks, createdAt, updatedAt
 *         }
 *       ]
 *     }
 *   ]
 * }
 */

// ── Helpers: app → DB row ──────────────────────────────────────────

// ── Helpers: DB row → app ──────────────────────────────────────────

// ── Fetch ──────────────────────────────────────────────────────────

const BOARD_COLUMNS = 'id, title, color, emoji, position, group_id, owner_id, created_at';
const LIST_COLUMNS = 'id, board_id, title, color, position, is_completion_list';
const CARD_COLUMNS = 'id, list_id, title, description, priority, due_date, start_date, is_all_day, recurrence_rule, my_day, day_category, estimated_minutes, labels, color, cover_attachment_id, created_at, updated_at, completed, position';
const SUBTASK_COLUMNS = 'id, card_id, title, done, position, link_url, link_label, created_at, updated_at';

/** Ids por requisição em `.in(...)`: centenas de UUIDs numa URL só estouram o limite do proxy. */
const IN_CHUNK = 120;

/**
 * `.in(coluna, ids)` em lotes. Qualquer lote com erro → erro (nunca devolve parcial: um board sem as
 * subtarefas, se salvo depois, apagaria as subtarefas do banco).
 */
async function selectIn(table, columns, column, ids, orderBy) {
  const rows = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    let q = supabase.from(table).select(columns).in(column, ids.slice(i, i + IN_CHUNK));
    if (orderBy) q = q.order(orderBy, { ascending: true });
    const { data, error } = await q;
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
  }
  if (orderBy && ids.length > IN_CHUNK) rows.sort((a, b) => (a[orderBy] ?? 0) - (b[orderBy] ?? 0));
  return { data: rows, error: null };
}

/** Listas, cards e subtarefas dos boards dados, montados no formato do app. */
async function loadBoardContents(boardRows) {
  const boardIds = boardRows.map((b) => b.id);
  const lists = boardIds.length
    ? await selectIn('lists', LIST_COLUMNS, 'board_id', boardIds, 'position')
    : { data: [], error: null };
  if (lists.error) return { data: null, error: lists.error.message || 'Erro ao carregar listas.' };

  const listIds = lists.data.map((l) => l.id);
  const cards = listIds.length
    ? await selectIn('cards', CARD_COLUMNS, 'list_id', listIds, 'position')
    : { data: [], error: null };
  if (cards.error) return { data: null, error: cards.error.message || 'Erro ao carregar cards.' };

  const cardIds = cards.data.map((c) => c.id);
  const subtasks = cardIds.length
    ? await selectIn('subtasks', SUBTASK_COLUMNS, 'card_id', cardIds)
    : { data: [], error: null };
  if (subtasks.error) return { data: null, error: subtasks.error.message || 'Erro ao carregar subtarefas.' };

  const subtasksByCard = {};
  for (const s of subtasks.data) (subtasksByCard[s.card_id] ??= []).push(s);
  const cardsByList = {};
  for (const c of cards.data) (cardsByList[c.list_id] ??= []).push(rowToCard(c, subtasksByCard[c.id] ?? []));
  const listsByBoard = {};
  for (const l of lists.data) (listsByBoard[l.board_id] ??= []).push(rowToList(l, cardsByList[l.id] ?? []));

  const data = boardRows
    .map((b) => ({ ...rowToBoard(b), lists: listsByBoard[b.id] ?? [] }))
    .sort((a, b) => (a.position - b.position) || (new Date(a.createdAt) - new Date(b.createdAt)));
  return { data, error: null };
}

/**
 * Busca todos os boards do usuário (owner ou member) com listas, cards e subtarefas.
 * Retorna { data, error }: em erro (sessão expirada, rede, etc.) error é preenchido e data é [];
 * assim o app não confunde "falha na API" com "usuário sem dados" e evita sobrescrever com boards padrão.
 */
export async function fetchBoards(userId) {
  if (!userId) return { data: [], error: null };

  const { data: owned, error: ownedErr } = await supabase
    .from('boards')
    .select(BOARD_COLUMNS)
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
    return { data: [], error: memberErr.message || 'Erro ao carregar participações em boards.' };
  }

  const ownedIds = new Set((owned ?? []).map(b => b.id));
  const memberBoardIds = (memberRows ?? []).map(r => r.board_id).filter(id => !ownedIds.has(id));
  let boardsData = [...(owned ?? [])];
  if (memberBoardIds.length > 0) {
    const shared = await selectIn('boards', BOARD_COLUMNS, 'id', memberBoardIds, 'position');
    if (shared.error) {
      console.error('[boardService] fetchBoards shared boards error', shared.error);
      return { data: [], error: shared.error.message || 'Erro ao carregar boards partilhados.' };
    }
    boardsData = boardsData.concat(shared.data);
  }

  if (!boardsData.length) {
    const { data: inv, error: invErr } = await supabase.rpc('board_inventory_for_current_user');
    if (invErr) {
      console.error('[boardService] fetchBoards inventory RPC error', invErr);
      return {
        data: [],
        error:
          invErr.message ||
          'Não foi possível verificar os boards na conta. Aplica a migração `20260330140000_board_inventory_rpc.sql` no Supabase.',
      };
    }
    const row = Array.isArray(inv) ? inv[0] : inv;
    const o = Number(row?.owned_boards ?? 0);
    const m = Number(row?.membership_rows ?? 0);
    if (o > 0 || m > 0) {
      return {
        data: [],
        error:
          'Os boards não foram carregados (lista vazia mas a conta tem dados). Costuma ser política RLS. Recarrega a página ou revê as migrações recentes em `board_members` / `boards`.',
      };
    }
    return { data: [], error: null };
  }

  const { data, error } = await loadBoardContents(boardsData);
  if (error) {
    console.error('[boardService] fetchBoards contents error', error);
    return { data: [], error };
  }
  return { data, error: null };
}

/**
 * Um board só (Realtime): antes cada evento recarregava TODOS os boards do usuário.
 * data = null quando o board não existe mais ou o usuário perdeu o acesso.
 */
export async function fetchBoard(boardId) {
  if (!boardId) return { data: null, error: null };
  const { data: row, error } = await supabase.from('boards').select(BOARD_COLUMNS).eq('id', boardId).maybeSingle();
  if (error) return { data: null, error: error.message || 'Erro ao carregar board.' };
  if (!row) return { data: null, error: null };
  const contents = await loadBoardContents([row]);
  if (contents.error) return { data: null, error: contents.error };
  return { data: contents.data[0] ?? null, error: null };
}

// ── Sharing helpers: members & invitations ───────────────────────────

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

/** Boards sendo criados agora: o join no collab espera (senão o servidor carrega o board vazio). */
const creatingBoards = new Map();

/** Resolve quando a criação do board (se houver) terminar. */
export function waitForBoardCreation(boardId) {
  return creatingBoards.get(boardId) ?? Promise.resolve();
}

/** Linhas em lotes: um INSERT por tabela em vez de um por linha. */
async function insertRows(table, rows) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + 500));
    if (error) return error;
  }
  return null;
}

/**
 * Insere um board completo (board + board_members + lists + cards + subtasks).
 * Antes: um INSERT por lista/card/subtarefa, e o board já abria (e entrava no collab) no meio do
 * caminho — o servidor carregava o board sem listas e o próximo flush apagava as listas padrão.
 */
export function insertBoardFull(userId, board) {
  const run = insertBoardFullNow(userId, board);
  creatingBoards.set(board.id, run);
  run.finally(() => {
    if (creatingBoards.get(board.id) === run) creatingBoards.delete(board.id);
  });
  return run;
}

async function insertBoardFullNow(userId, board) {
  const boardId = board.id;

  const { error: boardErr } = await supabase.from('boards').insert({
    id: boardId,
    owner_id: userId,
    title: board.title ?? 'Novo Board',
    color: board.color ?? null,
    emoji: board.emoji ?? '📋',
    position: board.position ?? 0,
    group_id: board.groupId ?? null,
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
  const cards = lists.flatMap((list) => (list.cards ?? []).map((card, ci) => cardToRow(card, list.id, ci)));
  const subtasks = lists.flatMap((list) => (list.cards ?? []).flatMap((card) =>
    (card.subtasks ?? []).map((st, si) => subtaskToRow(st, card.id, si))));
  const steps = [
    ['lists', lists.map((list, i) => listToRow(list, boardId, i))],
    ['cards', cards],
    ['subtasks', subtasks],
  ];
  for (const [table, rows] of steps) {
    const err = rows.length ? await insertRows(table, rows) : null;
    if (err) {
      console.error(`[boardService] insertBoardFull ${table} error`, err);
      return { success: false, error: err.message };
    }
  }

  return { success: true };
}

/**
 * Atualiza um board de forma inteligente (Upsert + Diff).
 * Em vez de deletar tudo, identifica o que foi removido e atualiza o resto em batch.
 * Timeout de 8s via AbortController: se qualquer chamada HTTP ao Supabase travar
 * (lock de token refresh, rede idle, etc.), a função rejeita limpamente após 8s.
 */
export async function updateBoardFull(userId, board) {
  console.log(`[boardService] upsertBoardFull: board "${board.title}" (${board.id})`);
  try {
    const { data, error } = await supabase.rpc('upsert_board_full', {
      p_board: {
        id: board.id,
        title: board.title ?? 'Novo Board',
        color: board.color ?? null,
        emoji: board.emoji ?? '📋',
        position: board.position ?? 0,
        groupId: board.groupId ?? null,
        lists: (board.lists ?? []).map(list => ({
          id: list.id,
          title: list.title ?? 'Nova Lista',
          color: list.color ?? null,
          isCompletionList: list.isCompletionList ?? false,
          cards: (list.cards ?? []).map(card => ({
            id: card.id,
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
            createdAt: card.createdAt ?? new Date().toISOString(),
            updatedAt: card.updatedAt ?? new Date().toISOString(),
            completed: card.completed ?? false,
            subtasks: (card.subtasks ?? []).map((st, index) => ({
              id: st.id,
              title: st.title ?? '',
              done: st.done ?? false,
              position: normalizePgIntPosition(st.position, index),
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
      console.error('[boardService] updateBoardFull RPC error:', error);
      return { success: false, error: error.message || 'Falha ao salvar board' };
    }

    const result = typeof data === 'string' ? JSON.parse(data) : data;
    if (!result?.success) {
      console.error('[boardService] updateBoardFull server error:', result?.error);
      return { success: false, error: result?.error || 'Falha ao salvar board' };
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

/** Pilha undo/redo do board (por utilizador). */
export async function fetchBoardUndoStack(boardId) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData?.session?.user?.id) {
    return { data: null, error: null };
  }
  const userId = sessionData.session.user.id;
  const { data, error } = await supabase
    .from('board_undo_stacks')
    .select('stack')
    .eq('user_id', userId)
    .eq('board_id', boardId)
    .maybeSingle();
  if (error) {
    console.error('[boardService] fetchBoardUndoStack', error);
    return { data: null, error: error.message };
  }
  return { data: data?.stack ?? null, error: null };
}

export async function upsertBoardUndoStack(boardId, stack) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData?.session?.user?.id) {
    return { success: false, error: 'Sessão inválida.' };
  }
  const userId = sessionData.session.user.id;
  const { error } = await supabase
    .from('board_undo_stacks')
    .upsert({
      user_id: userId,
      board_id: boardId,
      stack,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,board_id' });
  if (error) {
    console.error('[boardService] upsertBoardUndoStack', error);
    return { success: false, error: error.message };
  }
  return { success: true };
}
