import { supabaseAdmin } from './supabase.js';

export async function verifyToken(token) {
  if (!token || !supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export async function canAccessSpace(userId, spaceId) {
  if (!userId || !spaceId || !supabaseAdmin) return false;
  const { data: space, error } = await supabaseAdmin
    .from('spaces')
    .select('id, owner_id')
    .eq('id', spaceId)
    .maybeSingle();
  if (error || !space) return false;
  if (space.owner_id === userId) return { access: true, canWrite: true };
  return { access: false, canWrite: false };
}

export async function canAccessBoard(userId, boardId) {
  if (!userId || !boardId || !supabaseAdmin) return false;

  const { data: board, error } = await supabaseAdmin
    .from('boards')
    .select('id, owner_id')
    .eq('id', boardId)
    .maybeSingle();

  if (error || !board) return false;

  if (board.owner_id === userId) {
    return { access: true, canWrite: true };
  }

  const { data: member } = await supabaseAdmin
    .from('board_members')
    .select('role')
    .eq('board_id', boardId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!member) return { access: false, canWrite: false };

  const canWrite = ['owner', 'admin', 'editor'].includes(member.role);
  return { access: true, canWrite };
}
