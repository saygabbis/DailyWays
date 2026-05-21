import { initialFromName } from '../utils/userColor';
import { resolvePresenceColor } from '../utils/presenceColor';
import { getPresenceFields } from './presenceBridge.js';

export function resolvePresenceDisplayName({ user, profile }) {
  return (
    profile?.name
    || user?.name
    || user?.user_metadata?.name
    || profile?.username
    || user?.email?.split('@')[0]
    || 'Usuário'
  );
}

function buildIdentity(boardId, auth) {
  const { user, profile } = auth || {};
  const name = resolvePresenceDisplayName({ user, profile });
  return {
    name,
    photoUrl: profile?.photo_url || null,
    avatarInitial: initialFromName(name),
    color: resolvePresenceColor({
      userId: user?.id,
      presenceColor: profile?.presence_color,
      presenceColorAuto: profile?.presence_color_auto !== false,
      photoUrl: profile?.photo_url,
    }),
    roomId: boardId,
  };
}

export function buildBoardPresencePayload(boardId, auth) {
  return {
    ...buildIdentity(boardId, auth),
    ...getPresenceFields(boardId),
  };
}

/** Cursor update — always carries identity so peers never stick on "Usuário". */
export function buildCursorPresencePayload(boardId, auth) {
  const fields = getPresenceFields(boardId);
  const payload = { ...buildIdentity(boardId, auth) };
  if (fields.cursor) payload.cursor = fields.cursor;
  if (fields.cursorScreen) payload.cursorScreen = fields.cursorScreen;
  return payload;
}
