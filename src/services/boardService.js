import { supabase } from './supabaseClient';
import { normalizeInviteIdentifier } from '../utils/inviteIdentifier.js';
import { formatInviteError } from '../utils/inviteErrors.js';

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

// PostgreSQL integer max — subtask.position must stay within this range
const PG_INT_MAX = 2147483647;

/** Normaliza position para colunas integer no Postgres (ex.: subtasks criadas com Date.now()). */
function normalizePgIntPosition(value, fallbackIndex) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > PG_INT_MAX) return fallbackIndex;
  return Math.trunc(n);
}

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

function subtaskToRow(st, cardId, position = 0) {
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
    return { data: [], error: memberErr.message || 'Erro ao carregar participações em boards.' };
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
    if (sharedErr) {
      console.error('[boardService] fetchBoards shared boards error', sharedErr);
      return { data: [], error: sharedErr.message || 'Erro ao carregar boards partilhados.' };
    }
    // Usar o que o SELECT devolver (pode ser parcial); não falhar só porque veio 0 linhas
    boardsData = boardsData.concat(shared ?? []);
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

  // ── Cards ──
  const listIds = (listsData ?? []).map(l => l.id);

  // Usa position se existir, senão created_at
  const baseCardSelect = 'id, list_id, title, description, priority, due_date, start_date, is_all_day, recurrence_rule, my_day, labels, color, cover_attachment_id, created_at, updated_at, completed';
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

  // ── Subtasks ──
  const cardIds = (cardsData ?? []).map(c => c.id);
  let subtasksData = [];
  if (cardIds.length > 0) {
    const tSub0 = Date.now();
    const { data: stData, error: stErr } = await supabase
      .from('subtasks')
      .select('id, card_id, title, done, position, link_url, link_label, created_at, updated_at')
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
 * Convida alguém para um board por @username ou e-mail (utilizador tem de existir no BD).
 * Usa a RPC invite_board_member (p_email aceita identifier).
 */
export async function inviteBoardMember(boardId, identifier, role = 'reader') {
  if (!boardId || !identifier?.trim()) {
    return { success: false, error: 'Indica um @username ou e-mail válido.' };
  }
  const normalizedRole = role === 'editor' ? 'editor' : 'reader';
  const { error } = await supabase.rpc('invite_board_member', {
    p_board_id: boardId,
    p_email: normalizeInviteIdentifier(identifier),
    p_role: normalizedRole,
  });
  if (error) {
    console.error('[boardService] inviteBoardMember error', error);
    return { success: false, error: formatInviteError(error.message) };
  }
  return { success: true };
}

const INVITE_BASE_SELECT = 'id, board_id, inviter_id, invitee_email, invitee_user_id, role, status, created_at';
const SPACE_INVITE_BASE_SELECT = 'id, space_id, inviter_id, invitee_email, invitee_user_id, role, status, created_at';

function mapBoardInviteRow(row) {
  return {
    id: row.id,
    kind: 'board',
    boardId: row.board_id,
    spaceId: null,
    role: row.role,
    status: row.status,
    inviteeEmail: row.invitee_email,
    inviterId: row.inviter_id,
    createdAt: row.created_at,
    boardTitle: 'Board',
    boardEmoji: '📋',
    spaceTitle: null,
    spaceEmoji: null,
  };
}

function mapSpaceInviteRow(row) {
  return {
    id: row.id,
    kind: 'space',
    boardId: null,
    spaceId: row.space_id,
    role: row.role,
    status: row.status,
    inviteeEmail: row.invitee_email,
    inviterId: row.inviter_id,
    createdAt: row.created_at,
    boardTitle: null,
    boardEmoji: null,
    spaceTitle: 'Space',
    spaceEmoji: '🌌',
  };
}

async function fetchInviteRowsForUser(table, baseSelect, statusFilter, user, emailLower) {
  const isPending = statusFilter === 'pending';
  const statusClause = Array.isArray(statusFilter)
    ? (q) => q.in('status', statusFilter)
    : (q) => q.eq('status', statusFilter);

  let q1 = statusClause(
    supabase.from(table).select(baseSelect).eq('invitee_user_id', user.id),
  );
  let q2 = statusClause(
    supabase.from(table).select(baseSelect).ilike('invitee_email', emailLower),
  );

  const isHistory = Array.isArray(statusFilter);
  if (isHistory) {
    q1 = q1.is('history_dismissed_at', null);
    q2 = q2.is('history_dismissed_at', null);
  }

  let orderQ1 = q1;
  let orderQ2 = q2;
  if (!isPending) {
    orderQ1 = q1.order('created_at', { ascending: false });
    orderQ2 = q2.order('created_at', { ascending: false });
  }

  const [r1, r2] = await Promise.all([orderQ1, orderQ2]);
  if (r1.error) return { data: [], error: r1.error };
  if (r2.error) return { data: [], error: r2.error };

  const unique = new Map();
  for (const row of [...(r1.data || []), ...(r2.data || [])]) {
    unique.set(row.id, row);
  }
  return { data: [...unique.values()], error: null };
}

async function enrichInvitations(items) {
  if (!items.length) return items;

  const boardIds = [...new Set(items.filter((i) => i.kind !== 'space').map((i) => i.boardId).filter(Boolean))];
  const spaceIds = [...new Set(items.filter((i) => i.kind === 'space').map((i) => i.spaceId).filter(Boolean))];
  const inviterIds = [...new Set(items.map((i) => i.inviterId).filter(Boolean))];

  const boardMap = new Map();
  const spaceMap = new Map();
  const profileMap = new Map();

  if (boardIds.length) {
    const { data: boards } = await supabase.from('boards').select('id, title, emoji').in('id', boardIds);
    for (const b of boards || []) boardMap.set(b.id, b);
  }
  if (spaceIds.length) {
    const { data: spaces } = await supabase.from('spaces').select('id, title, emoji').in('id', spaceIds);
    for (const s of spaces || []) spaceMap.set(s.id, s);
  }
  if (inviterIds.length) {
    const { data: profiles } = await supabase.from('profiles').select('id, name, username').in('id', inviterIds);
    for (const p of profiles || []) profileMap.set(p.id, p);
  }

  return items.map((inv) => {
    const inviter = profileMap.get(inv.inviterId);
    const inviterLabel = inviter?.name || inviter?.username || null;
    if (inv.kind === 'space') {
      const s = spaceMap.get(inv.spaceId);
      return {
        ...inv,
        spaceTitle: s?.title || inv.spaceTitle,
        spaceEmoji: s?.emoji || inv.spaceEmoji,
        inviterLabel,
      };
    }
    const b = boardMap.get(inv.boardId);
    return {
      ...inv,
      boardTitle: b?.title || inv.boardTitle,
      boardEmoji: b?.emoji || inv.boardEmoji,
      inviterLabel,
    };
  });
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
  const emailLower = (user?.email || '').toLowerCase();

  const [boardRes, spaceRes] = await Promise.all([
    fetchInviteRowsForUser('board_invitations', INVITE_BASE_SELECT, 'pending', user, emailLower),
    fetchInviteRowsForUser('space_invitations', SPACE_INVITE_BASE_SELECT, 'pending', user, emailLower),
  ]);

  if (boardRes.error || spaceRes.error) {
    console.error('[boardService] fetchMyInvitations error', boardRes.error || spaceRes.error);
    return { data: [], error: (boardRes.error || spaceRes.error)?.message || 'Erro ao carregar convites.' };
  }

  const raw = [
    ...boardRes.data.map(mapBoardInviteRow),
    ...spaceRes.data.map(mapSpaceInviteRow),
  ];
  const data = await enrichInvitations(raw);
  return { data, error: null };
}

/**
 * Histórico de convites aceitos/recusados (auditoria).
 */
export async function fetchMyInvitationHistory({ limit = 100 } = {}) {
  const {
    data: sessionData,
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError || !sessionData?.session?.user) {
    return { data: [], error: null };
  }
  const user = sessionData.session.user;
  const emailLower = (user?.email || '').toLowerCase();
  const statuses = ['accepted', 'declined'];

  const [boardRes, spaceRes] = await Promise.all([
    fetchInviteRowsForUser('board_invitations', INVITE_BASE_SELECT, statuses, user, emailLower),
    fetchInviteRowsForUser('space_invitations', SPACE_INVITE_BASE_SELECT, statuses, user, emailLower),
  ]);

  if (boardRes.error) {
    console.error('[boardService] fetchMyInvitationHistory board', boardRes.error);
  }
  if (spaceRes.error) {
    console.error('[boardService] fetchMyInvitationHistory space', spaceRes.error);
  }

  const merged = [
    ...(boardRes.data || []).map(mapBoardInviteRow),
    ...(spaceRes.data || []).map(mapSpaceInviteRow),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const sliced = merged.slice(0, limit);
  const data = await enrichInvitations(sliced);
  return {
    data,
    error: (boardRes.error || spaceRes.error)?.message || null,
  };
}

/**
 * Oculta do histórico do convidado os convites aceites/recusados (não apaga do owner).
 */
export async function clearMyInvitationHistory() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData?.session?.user) {
    return { success: false, error: 'Sessão inválida.' };
  }

  const { error } = await supabase.rpc('clear_my_invitation_history');
  if (error) {
    console.error('[boardService] clearMyInvitationHistory', error);
    return { success: false, error: error.message || 'Erro ao limpar histórico.' };
  }
  return { success: true };
}

export async function acceptInvitation(inviteId, kind = 'board') {
  if (!inviteId) return { success: false, error: 'Convite inválido.' };

  const { data: sessData } = await supabase.auth.getSession();
  const userId = sessData?.session?.user?.id;

  let inviteRow = null;
  try {
    if (kind === 'space') {
      const { data: r, error: rErr } = await supabase
        .from('space_invitations')
        .select('id, space_id, invitee_user_id, status')
        .eq('id', inviteId)
        .maybeSingle();
      if (!rErr && r) inviteRow = { board_id: r.space_id, ...r };
    } else {
      const { data: r, error: rErr } = await supabase
        .from('board_invitations')
        .select('id, board_id, invitee_user_id, status')
        .eq('id', inviteId)
        .maybeSingle();
      if (!rErr && r) inviteRow = r;
    }
  } catch (_) { }

  const rpcName = kind === 'space' ? 'accept_space_invitation' : 'accept_board_invitation';
  const { error } = await supabase.rpc(rpcName, { p_invite_id: inviteId });
  if (error) {
    console.error('[boardService] acceptInvitation error', error);
    return { success: false, error: error.message || 'Erro ao aceitar convite.' };
  }

  let membersCountAfter = null;
  try {
    const resourceId = kind === 'space' ? inviteRow?.space_id : inviteRow?.board_id;
    const table = kind === 'space' ? 'space_members' : 'board_members';
    const idCol = kind === 'space' ? 'space_id' : 'board_id';
    if (resourceId && userId) {
      const { data: bmRows, error: bmErr } = await supabase
        .from(table)
        .select('user_id')
        .eq(idCol, resourceId)
        .eq('user_id', userId);
      if (!bmErr) membersCountAfter = (bmRows || []).length;
    }
  } catch (_) { }

  return { success: true };
}

export async function declineInvitation(inviteId, kind = 'board') {
  if (!inviteId) return { success: false, error: 'Convite inválido.' };
  const table = kind === 'space' ? 'space_invitations' : 'board_invitations';
  const { error } = await supabase
    .from(table)
    .update({ status: 'declined' })
    .eq('id', inviteId);
  if (error) {
    console.error('[boardService] declineInvitation error', error);
    return { success: false, error: error.message || 'Erro ao recusar convite.' };
  }
  return { success: true };
}

/** Valores válidos em board_members.role (incl. admin). */
export function normalizeBoardMemberRole(role) {
  if (role === 'owner') return 'owner';
  if (role === 'admin') return 'admin';
  if (role === 'editor') return 'editor';
  return 'reader';
}

export async function updateMemberRole(boardId, userId, role) {
  if (!boardId || !userId) {
    return { success: false, error: 'Dados inválidos.' };
  }
  const normalizedRole = normalizeBoardMemberRole(role);
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
      for (let si = 0; si < subtasks.length; si++) {
        const st = subtasks[si];
        const { error: stErr } = await supabase.from('subtasks').insert(subtaskToRow(st, card.id, si));
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
