/**
 * Guarda o JWT de quem pode escrever na sala, para o flush gravar com RLS.
 * Um token por usuário (o mais recente): se o do último editor expirar, o flush usa o de outro
 * editor em vez de falhar para sempre (antes a sala ficava suja e as edições nunca iam ao banco).
 */
export function noteRoomFlushContext(room, { accessToken, userId } = {}) {
  if (!room) return;
  if (accessToken) room.flushAccessToken = accessToken;
  if (userId) room.flushUserId = userId;
  if (accessToken && userId) {
    if (!room.writerTokens) room.writerTokens = new Map();
    room.writerTokens.set(userId, accessToken);
  }
}

/** Token novo do mesmo usuário (renovação de sessão): troca onde ele estiver guardado. */
export function refreshRoomFlushToken(room, { userId, accessToken } = {}) {
  if (!room || !userId || !accessToken) return;
  if (room.writerTokens?.has(userId)) room.writerTokens.set(userId, accessToken);
  if (room.flushUserId === userId) room.flushAccessToken = accessToken;
}

/** O token atual foi recusado (expirou/revogado): passa para o de outro editor, se houver. */
export function rotateRoomFlushToken(room) {
  if (!room) return false;
  const bad = room.flushAccessToken;
  if (room.writerTokens) {
    for (const [uid, token] of room.writerTokens) {
      if (token === bad) room.writerTokens.delete(uid);
    }
    const next = room.writerTokens.entries().next().value;
    if (next) {
      [room.flushUserId, room.flushAccessToken] = next;
      return true;
    }
  }
  room.flushAccessToken = null;
  room.flushUserId = null;
  return false;
}

export function isAuthFlushError(err) {
  const msg = `${err?.code || ''} ${err?.message || err || ''}`;
  return /jwt|PGRST30\d|401|Unauthorized|Não autenticado|Sem permissão/i.test(msg);
}
