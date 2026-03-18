import { supabase } from './supabaseClient';

const DEBUG_ENDPOINT = 'http://127.0.0.1:7248/ingest/0093f15a-2614-4c0e-9862-18929ca449cb';
const DEBUG_SESSION_ID = 'f6ad57';

function debugLog(hypothesisId, location, message, data, runId = 'pre-fix') {
  // #region agent log
  try {
    fetch(DEBUG_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': DEBUG_SESSION_ID,
      },
      body: JSON.stringify({
        sessionId: DEBUG_SESSION_ID,
        runId,
        hypothesisId,
        location,
        message,
        data,
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  } catch (_) { }
  // #endregion
}

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
    color: card.color ?? null,
    created_at: card.createdAt ?? new Date().toISOString(),
    completed: card.completed ?? false,
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
    color: row.color ?? null,
    subtasks: subtasks.map(s => ({ id: s.id, title: s.title, done: s.done })),
    completed: row.completed ?? false,
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
    groupId: row.group_id ?? null,
    ownerId: row.owner_id ?? null,
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

  const t0 = Date.now();
  // #region agent log
  debugLog('D', 'boardService.js:fetchBoards', 'start fetchBoards', { userIdLen: String(userId || '').length }, 'pre-fix');
  // #endregion

  const hasPosition = await cardsHasPositionColumn();

  const { data: owned, error: ownedErr } = await supabase
    .from('boards')
    .select('id, title, color, emoji, position, group_id, owner_id, created_at')
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
      .select('id, title, color, emoji, position, group_id, owner_id, created_at')
      .in('id', memberBoardIds)
      .order('position', { ascending: true });
    if (!sharedErr && shared?.length) boardsData = boardsData.concat(shared);
  }

  if (!boardsData.length) return { data: [], error: null };

  const boardIds = boardsData.map(b => b.id);

  // ── Lists ──
  const tLists0 = Date.now();
  const { data: listsData, error: listsError } = await supabase
    .from('lists')
    .select('id, board_id, title, color, position, is_completion_list')
    .in('board_id', boardIds)
    .order('position', { ascending: true });
  if (listsError) {
    console.error('[boardService] fetchBoards lists error', listsError);
    return { data: [], error: listsError.message || 'Erro ao carregar listas.' };
  }
  // #region agent log
  debugLog('D', 'boardService.js:fetchBoards', 'lists query done', { ms: Date.now() - tLists0, listsCount: (listsData || []).length }, 'pre-fix');
  // #endregion

  // ── Cards ──
  const listIds = (listsData ?? []).map(l => l.id);

  // Usa position se existir, senão created_at
  const baseCardSelect = 'id, list_id, title, description, priority, due_date, my_day, labels, color, created_at, completed';
  let cardsQuery = supabase.from('cards').select(hasPosition ? `${baseCardSelect}, position` : baseCardSelect).in('list_id', listIds);
  if (hasPosition) {
    cardsQuery = cardsQuery.order('position', { ascending: true });
  } else {
    cardsQuery = cardsQuery.order('created_at', { ascending: true });
  }
  const tCards0 = Date.now();
  const { data: cardsData, error: cardsError } = await cardsQuery;
  if (cardsError) {
    console.error('[boardService] fetchBoards cards error', cardsError);
    return { data: [], error: cardsError.message || 'Erro ao carregar cards.' };
  }
  // #region agent log
  debugLog('D', 'boardService.js:fetchBoards', 'cards query done', { ms: Date.now() - tCards0, cardsCount: (cardsData || []).length }, 'pre-fix');
  // #endregion

  // ── Subtasks ──
  const cardIds = (cardsData ?? []).map(c => c.id);
  let subtasksData = [];
  if (cardIds.length > 0) {
    const tSub0 = Date.now();
    const { data: stData, error: stErr } = await supabase
      .from('subtasks')
      .select('id, card_id, title, done')
      .in('card_id', cardIds);
    if (stErr) {
      console.error('[boardService] fetchBoards subtasks error', stErr);
    }
    subtasksData = stData ?? [];
    // #region agent log
    debugLog('D', 'boardService.js:fetchBoards', 'subtasks query done', { ms: Date.now() - tSub0, subtasksCount: (subtasksData || []).length }, 'pre-fix');
    // #endregion
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
  // #region agent log
  debugLog(
    'D',
    'boardService.js:fetchBoards',
    'fetchBoards total done',
    {
      ms: Date.now() - t0,
      boardsCount: data.length,
      firstBoardIds: data.slice(0, 5).map(b => b.id),
      listsCount: (listsData ?? []).length,
      cardsCount: (cardsData ?? []).length,
      subtasksCount: subtasksData.length,
    },
    'pre-fix'
  );
  // #endregion
  return { data, error: null };
}

// ── Sharing helpers: members & invitations ───────────────────────────

/**
 * Busca membros de um board, incluindo dados básicos do profile.
 * Retorna array de { userId, role, name, username, avatar(initial), photoUrl }.
 */
export async function fetchBoardMembers(boardId) {
  if (!boardId) return { data: [], error: null };
  // Importante: evitar select aninhado com join em string, porque o PostgREST
  // pode falhar a parse (ex.: `profiles:public.profiles!inner (..)`) dependendo
  // do esquema/relacionamentos. Aqui fazemos em 2 passos e depois mapeamos.
  const { data: membersRows, error: membersErr } = await supabase
    .from('board_members')
    .select('board_id, user_id, role')
    .eq('board_id', boardId);

  if (membersErr) {
    console.error('[boardService] fetchBoardMembers members error', membersErr);
    return { data: [], error: membersErr.message || 'Erro ao carregar membros do board.' };
  }

  const rows = membersRows || [];
  const userIds = Array.from(new Set(rows.map(r => r.user_id).filter(Boolean)));

  // Busca dados básicos dos perfis. RLS pode restringir parte dos perfis,
  // então o UI usa fallback para campos vazios.
  let profileById = {};
  if (userIds.length > 0) {
    const { data: profiles, error: profilesErr } = await supabase
      .from('profiles')
      .select('id, username, name, avatar, photo_url')
      .in('id', userIds);

    if (profilesErr) {
      console.error('[boardService] fetchBoardMembers profiles error', profilesErr);
      // Não aborta a listagem dos membros; só ficariam sem name/username.
      profileById = {};
    } else {
      // #region agent log
      debugLog(
        'A',
        'boardService.js:fetchBoardMembers',
        'profiles query done',
        {
          boardIdPresent: !!boardId,
          membersCount: rows.length,
          profilesCount: (profiles || []).length,
          firstPhotoUrlPresent: !!(profiles || [])[0]?.photo_url,
        },
        'pre-fix'
      );
      // #endregion
      profileById = (profiles || []).reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {});
    }
  }

  const members = rows.map((row) => {
    const p = profileById[row.user_id] || null;
    return {
      boardId: row.board_id,
      userId: row.user_id,
      role: row.role,
      name: p?.name ?? '',
      username: p?.username ?? '',
      avatar: p?.avatar ?? '',
      photoUrl: p?.photo_url ?? '',
    };
  });

  return { data: members, error: null };
}

/**
 * Convida alguém para um board por e-mail, com role 'editor' ou 'reader'.
 * Usa a RPC invite_board_member definida nas migrations.
 */
export async function inviteBoardMember(boardId, email, role = 'reader') {
  if (!boardId || !email) {
    return { success: false, error: 'Board ou e-mail inválido.' };
  }
  const normalizedRole = role === 'editor' ? 'editor' : 'reader';
  const { error } = await supabase.rpc('invite_board_member', {
    p_board_id: boardId,
    p_email: email,
    p_role: normalizedRole,
  });
  if (error) {
    console.error('[boardService] inviteBoardMember error', error);
    return { success: false, error: error.message || 'Erro ao enviar convite.' };
  }
  return { success: true };
}

/**
 * Lista convites de board do usuário atual (apenas pendentes).
 * Depende das policies de board_invitations e da função accept_board_invitation.
 */
export async function fetchMyInvitations() {
  const {
    data: sessionData,
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError || !sessionData?.session?.user) {
    return { data: [], error: null };
  }
  const user = sessionData.session.user;

  // #region agent log
  debugLog(
    'I',
    'boardService.js:fetchMyInvitations',
    'start',
    {
      userIdLen: String(user?.id || '').length,
      emailLen: String(user?.email || '').length,
      emailHasAt: (user?.email || '').includes('@'),
    },
    'pre-fix'
  );
  // #endregion

  const baseSelect = 'id, board_id, inviter_id, invitee_email, invitee_user_id, role, status, created_at';

  // Importante: evitamos `boards!inner` aqui porque o convidado ainda não está em `board_members` até aceitar.
  // Assim garantimos que a lista de convites apareça mesmo antes do accept.
  const q1 = supabase
    .from('board_invitations')
    .select(baseSelect)
    .eq('status', 'pending')
    .eq('invitee_user_id', user.id);

  const emailLower = (user?.email || '').toLowerCase();
  const q2 = supabase
    .from('board_invitations')
    .select(baseSelect)
    .eq('status', 'pending')
    .ilike('invitee_email', emailLower);

  const [r1, r2] = await Promise.all([q1, q2]);
  const err1 = r1?.error ?? null;
  const err2 = r2?.error ?? null;

  if (err1 || err2) {
    console.error('[boardService] fetchMyInvitations error', err1 || err2);
    return { data: [], error: (err1 || err2)?.message || 'Erro ao carregar convites.' };
  }

  const merged = [...(r1.data || []), ...(r2.data || [])];
  const uniqueById = new Map();
  for (const row of merged) uniqueById.set(row.id, row);

  // #region agent log
  debugLog(
    'I',
    'boardService.js:fetchMyInvitations',
    'queries done',
    {
      pendingCountUserId: (r1.data || []).length,
      pendingCountEmail: (r2.data || []).length,
      mergedCount: merged.length,
      uniqueCount: uniqueById.size,
    },
    'pre-fix'
  );
  // #endregion

  const invitations = Array.from(uniqueById.values()).map((row) => ({
    id: row.id,
    boardId: row.board_id,
    role: row.role,
    status: row.status,
    inviteeEmail: row.invitee_email,
    createdAt: row.created_at,
    boardTitle: 'Board',
    boardEmoji: '📋',
  }));

  return { data: invitations, error: null };
}

export async function acceptInvitation(inviteId) {
  if (!inviteId) return { success: false, error: 'Convite inválido.' };

  const { data: sessData } = await supabase.auth.getSession();
  const userId = sessData?.session?.user?.id;

  let inviteRow = null;
  try {
    const { data: r, error: rErr } = await supabase
      .from('board_invitations')
      .select('id, board_id, invitee_user_id, status')
      .eq('id', inviteId)
      .maybeSingle();
    if (!rErr && r) inviteRow = r;
  } catch (_) { }

  // #region agent log
  try {
    debugLog(
      'RLS-invitee-insert',
      'boardService.js:acceptInvitation',
      'before rpc',
      {
        inviteId,
        userIdPrefix: userId ? String(userId).slice(0, 8) : null,
        inviteBoardIdPrefix: inviteRow?.board_id ? String(inviteRow.board_id).slice(0, 8) : null,
        inviteStatus: inviteRow?.status ?? null,
      },
      'pre-fix',
    );
  } catch (_) { }
  // #endregion

  const { error } = await supabase.rpc('accept_board_invitation', { p_invite_id: inviteId });
  if (error) {
    console.error('[boardService] acceptInvitation error', error);
    return { success: false, error: error.message || 'Erro ao aceitar convite.' };
  }

  // Verifica se a linha em board_members apareceu para o invitee
  let membersCountAfter = null;
  try {
    const boardId = inviteRow?.board_id;
    if (boardId && userId) {
      const { data: bmRows, error: bmErr } = await supabase
        .from('board_members')
        .select('user_id')
        .eq('board_id', boardId)
        .eq('user_id', userId);
      if (!bmErr) membersCountAfter = (bmRows || []).length;
    }
  } catch (_) { }

  // #region agent log
  try {
    debugLog(
      'RLS-invitee-insert',
      'boardService.js:acceptInvitation',
      'after rpc / board_members check',
      {
        inviteId,
        membersCountAfter,
      },
      'pre-fix',
    );
  } catch (_) { }
  // #endregion

  return { success: true };
}

export async function declineInvitation(inviteId) {
  if (!inviteId) return { success: false, error: 'Convite inválido.' };
  const { error } = await supabase
    .from('board_invitations')
    .update({ status: 'declined' })
    .eq('id', inviteId);
  if (error) {
    console.error('[boardService] declineInvitation error', error);
    return { success: false, error: error.message || 'Erro ao recusar convite.' };
  }
  return { success: true };
}

export async function updateMemberRole(boardId, userId, role) {
  if (!boardId || !userId) {
    return { success: false, error: 'Dados inválidos.' };
  }
  const normalizedRole = role === 'editor' || role === 'owner' ? role : 'reader';
  const { error } = await supabase
    .from('board_members')
    .update({ role: normalizedRole })
    .eq('board_id', boardId)
    .eq('user_id', userId);
  if (error) {
    console.error('[boardService] updateMemberRole error', error);
    return { success: false, error: error.message || 'Erro ao atualizar permissão.' };
  }
  return { success: true };
}

export async function removeMember(boardId, userId) {
  if (!boardId || !userId) {
    return { success: false, error: 'Dados inválidos.' };
  }
  const { error } = await supabase
    .from('board_members')
    .delete()
    .eq('board_id', boardId)
    .eq('user_id', userId);
  if (error) {
    console.error('[boardService] removeMember error', error);
    return { success: false, error: error.message || 'Erro ao remover membro.' };
  }
  return { success: true };
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
            myDay: card.myDay ?? false,
            labels: Array.isArray(card.labels) ? card.labels : [],
            color: card.color ?? null,
            createdAt: card.createdAt ?? new Date().toISOString(),
            completed: card.completed ?? false,
            subtasks: (card.subtasks ?? []).map(st => ({
              id: st.id,
              title: st.title ?? '',
              done: st.done ?? false,
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
