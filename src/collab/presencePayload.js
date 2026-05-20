import { initialFromName } from '../utils/userColor';
import { resolvePresenceColor } from '../utils/presenceColor';
import { getPresenceFields } from './presenceBridge.js';

export function buildBoardPresencePayload(boardId, { user, profile }) {
  const name =
    profile?.full_name ||
    profile?.name ||
    profile?.username ||
    user?.email?.split('@')[0] ||
    'Usuário';
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
    ...getPresenceFields(boardId),
  };
}

/** Lightweight cursor-only update (merged server-side with existing presence). */
export function buildCursorPresencePayload(boardId) {
  const fields = getPresenceFields(boardId);
  const payload = { roomId: boardId };
  if (fields.cursor) payload.cursor = fields.cursor;
  if (fields.cursorScreen) payload.cursorScreen = fields.cursorScreen;
  return payload;
}
