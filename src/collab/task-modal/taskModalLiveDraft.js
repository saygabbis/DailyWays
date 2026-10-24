/** Snapshot leve do modal para presença em tempo real. */
export function buildTaskModalLiveDraft({
  title,
  description,
  commentBody,
}) {
  return {
    title: title ?? null,
    description: description ?? null,
    commentBody: commentBody ?? null,
  };
}

/**
 * Preview ao vivo só de texto (evita briga de cor/prioridade/datas entre dois editores).
 * Campos estruturais vêm do UPDATE_CARD remoto + sync do liveCard.
 */
export function applyPeerTaskModalDraft(draft, focused, setters) {
  if (!draft) return;
  if (!focused.title && draft.title != null) setters.setTitle(draft.title);
  if (!focused.description && draft.description != null) setters.setDescription(draft.description);
  if (!focused.comment && draft.commentBody != null) setters.setCommentBody(draft.commentBody);
}
