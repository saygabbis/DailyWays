import { initialFromName } from '../../../utils/userColor';
import { resolvePresenceColor } from '../../../utils/presenceColor';
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

function buildIdentity(roomId, auth) {
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
    roomId,
  };
}

function presenceFieldsForEmit(roomId) {
  const f = getPresenceFields(roomId);
  const out = {
    selectedCardId: f.selectedCardId ?? null,
    selectedCardIds: f.selectedCardIds ?? [],
    onBoardSurface: f.onBoardSurface !== false,
    draggingCardId: f.draggingCardId ?? null,
    draggingListId: f.draggingListId ?? null,
    hoverCardId: f.hoverCardId ?? null,
    hoverListId: f.hoverListId ?? null,
    hoverUiKey: f.hoverUiKey ?? null,
    hoverModalEl: f.hoverModalEl ?? null,
    liveDraft: f.liveDraft ?? null,
  };
  if (f.selectedNodeIds != null) out.selectedNodeIds = f.selectedNodeIds;
  if (typeof f.cursor?.x === 'number' && typeof f.cursor?.y === 'number') {
    out.cursor = f.cursor;
  }
  if (Array.isArray(f.draggingNodeIds)) out.draggingNodeIds = f.draggingNodeIds;
  if (Array.isArray(f.dragPreviewRects)) out.dragPreviewRects = f.dragPreviewRects;
  if (f.cursorModal && typeof f.cursorModal.x === 'number' && typeof f.cursorModal.y === 'number') {
    out.cursorModal = f.cursorModal;
  } else if (!f.selectedCardId) {
    out.cursorModal = null;
  } else if (f.selectedCardId && f.cursorScreen && typeof f.cursorScreen.x === 'number') {
    out.cursorScreen = f.cursorScreen;
  }
  return out;
}

export function buildBoardPresencePayload(roomId, auth) {
  return {
    ...buildIdentity(roomId, auth),
    ...presenceFieldsForEmit(roomId),
  };
}

/** Cursor + meta de contexto (selectedCardId, etc.) em cada movimento. */
export function buildCursorPresencePayload(roomId, auth) {
  return {
    ...buildIdentity(roomId, auth),
    ...presenceFieldsForEmit(roomId),
  };
}
