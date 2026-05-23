import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDbClient, supabaseAdmin } from './supabase.js';
import { verifyUserJwt } from './verifyJwt.js';

const DEBUG_LOG = path.resolve(
  fileURLToPath(import.meta.url),
  '../../../debug-64ad20.log',
);

function agentLog(payload) {
  try {
    fs.appendFileSync(
      DEBUG_LOG,
      `${JSON.stringify({ sessionId: '64ad20', timestamp: Date.now(), ...payload })}\n`,
    );
  } catch {
    /* ignore */
  }
}

export async function verifyToken(token) {
  if (!token) {
    // #region agent log
    agentLog({
      hypothesisId: 'H2',
      location: 'auth.js:verifyToken',
      message: 'verifyToken no token',
      data: { hasToken: false },
    });
    // #endregion
    return null;
  }

  const user = await verifyUserJwt(token);
  // #region agent log
  agentLog({
    hypothesisId: user ? 'H3-fixed' : 'H3',
    location: 'auth.js:verifyToken',
    message: 'verifyToken JWKS result',
    data: {
      hasUser: Boolean(user),
      tokenLen: token.length,
      viaAdmin: Boolean(supabaseAdmin),
    },
  });
  // #endregion

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
  return { access: false, canWrite: false };
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
    // #region agent log
    agentLog({
      hypothesisId: 'H7',
      location: 'auth.js:canAccessBoard',
      message: 'board lookup failed',
      data: {
        boardIdPrefix: boardId?.slice(0, 8),
        userIdPrefix: userId?.slice(0, 8),
        errCode: error?.code ?? null,
        errMsg: error?.message?.slice(0, 80) ?? null,
        viaAdmin: Boolean(supabaseAdmin),
      },
    });
    // #endregion
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
    // #region agent log
    agentLog({
      hypothesisId: 'H7',
      location: 'auth.js:canAccessBoard',
      message: 'member lookup',
      data: {
        hasMember: Boolean(member),
        memberErr: memberErr?.message?.slice(0, 80) ?? null,
      },
    });
    // #endregion
    return { access: false, canWrite: false };
  }

  const canWrite = ['owner', 'admin', 'editor'].includes(member.role);
  return { access: true, canWrite };
}
