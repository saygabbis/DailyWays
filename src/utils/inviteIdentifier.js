/** Normaliza entrada de convite: @username, username ou email. */
export function normalizeInviteIdentifier(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('@')) return trimmed.slice(1).trim().toLowerCase();
  return trimmed;
}

/** true se parece email (tem @ com domínio). */
export function looksLikeEmail(value) {
  const v = (value || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
