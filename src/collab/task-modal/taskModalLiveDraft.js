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

export function hasTaskModalLiveDraft(draft) {
  if (!draft || typeof draft !== 'object') return false;
  return Object.values(draft).some((v) => v != null && (typeof v !== 'object' || v.length > 0));
}

export function liveDraftMetaSig(draft) {
  if (!draft) return '';
  return JSON.stringify(draft);
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
