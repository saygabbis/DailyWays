import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBoardEditorsFromCollab } from './useBoardEditorsFromCollab';
import { resolvePresenceDisplayName } from '../collab/presencePayload.js';
import { resolvePresenceColor } from '../utils/presenceColor';
import { initialFromName } from '../utils/userColor';

/**
 * Editores remotos + você na task aberta no overlay (stroke + avatar no card).
 */
export function useMergedBoardEditors(focusedCardId, boardId) {
  const editorsByCardId = useBoardEditorsFromCollab();
  const { user, profile } = useAuth();

  return useMemo(() => {
    const merged = { ...editorsByCardId };

    if (!focusedCardId || !boardId || !user?.id) return merged;

    const name = resolvePresenceDisplayName({ user, profile });
    const selfEditor = {
      userId: user.id,
      name,
      photoUrl: profile?.photo_url || null,
      avatarInitial: initialFromName(name),
      color: resolvePresenceColor({
        userId: user.id,
        presenceColor: profile?.presence_color,
        presenceColorAuto: profile?.presence_color_auto !== false,
        photoUrl: profile?.photo_url,
      }),
      isSelf: true,
    };

    const remote = (merged[focusedCardId] || []).filter((e) => e.userId !== user.id);
    merged[focusedCardId] = [selfEditor, ...remote];

    return merged;
  }, [editorsByCardId, focusedCardId, boardId, user?.id, profile?.name, profile?.photo_url, profile?.presence_color, profile?.presence_color_auto]);
}
