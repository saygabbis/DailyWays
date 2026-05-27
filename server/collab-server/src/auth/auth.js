import { getDbClient, supabaseAdmin } from '../db/supabase.js';
import { devLog } from '../devLog.js';
import { verifyUserJwt } from './verifyJwt.js';

export async function verifyToken(token) {
  if (!token) {
    devLog('auth.verifyToken sem token');
    return null;
  }

  const user = await verifyUserJwt(token);
  devLog('auth.verifyToken resultado JWKS', {
    hasUser: Boolean(user),
    tokenLen: token.length,
    viaAdmin: Boolean(supabaseAdmin),
  });

  if (user) return user;

  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export async function canAccessSpace(userId, spaceId, accessToken) {
  if (!userId || !spaceId) return false;
  const db = getDbClient(accessToken);
  if (!db) return false;
  const { data: space, error } = await db
    .from('spaces')
    .select('id, owner_id')
    .eq('id', spaceId)
    .maybeSingle();
  if (error || !space) return false;
  if (space.owner_id === userId) return { access: true, canWrite: true };

  const { data: member, error: memberErr } = await db
    .from('space_members')
    .select('role')
    .eq('space_id', spaceId)
    .eq('user_id', userId)
    .maybeSingle();

  if (memberErr || !member) {
    return { access: false, canWrite: false };
  }

  const canWrite = member.role === 'editor';
  return { access: true, canWrite };
}

export async function canAccessBoard(userId, boardId, accessToken) {
  if (!userId || !boardId) return false;
  const db = getDbClient(accessToken);
  if (!db) return false;

  const { data: board, error } = await db
    .from('boards')
    .select('id, owner_id')
    .eq('id', boardId)
    .maybeSingle();

  if (error || !board) {
    devLog('auth.canAccessBoard board lookup falhou', {
      boardIdPrefix: boardId?.slice(0, 8),
      userIdPrefix: userId?.slice(0, 8),
      errCode: error?.code ?? null,
      errMsg: error?.message?.slice(0, 80) ?? null,
      viaAdmin: Boolean(supabaseAdmin),
    });
    return { access: false, canWrite: false };
  }

  if (board.owner_id === userId) {
    return { access: true, canWrite: true };
  }

  const { data: member, error: memberErr } = await db
    .from('board_members')
    .select('role')
    .eq('board_id', boardId)
    .eq('user_id', userId)
    .maybeSingle();

  if (memberErr || !member) {
    devLog('auth.canAccessBoard member lookup', {
      hasMember: Boolean(member),
      memberErr: memberErr?.message?.slice(0, 80) ?? null,
    });
    return { access: false, canWrite: false };
  }

  const canWrite = ['owner', 'admin', 'editor'].includes(member.role);
  return { access: true, canWrite };
}
