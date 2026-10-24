import { supabase } from './supabaseClient';
import { normalizeInviteIdentifier } from '../utils/inviteIdentifier.js';
import { formatInviteError } from '../utils/inviteErrors.js';

/** Compartilhamento de boards/spaces: membros, papéis e convites (enviar, listar, aceitar, recusar, histórico). */
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

  const rpcName = kind === 'space' ? 'accept_space_invitation' : 'accept_board_invitation';
  const { error } = await supabase.rpc(rpcName, { p_invite_id: inviteId });
  if (error) {
    console.error('[boardService] acceptInvitation error', error);
    return { success: false, error: error.message || 'Erro ao aceitar convite.' };
  }

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
function normalizeBoardMemberRole(role) {
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
