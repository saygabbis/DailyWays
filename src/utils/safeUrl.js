/**
 * Links vindos de usuários (subtarefas, anexos, nós do Space, chat).
 * Só http(s) vira link clicável: `javascript:`, `data:` etc. ficam de fora (o banco também recusa
 * desde a migration 20261024210000).
 */

const HTTP_RE = /^https?:\/\//i;

/** Para gravar: "site.com/x" vira "https://site.com/x"; o que não parece endereço → null. */
export function normalizeHttpUrl(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  if (HTTP_RE.test(raw)) return raw;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null; // outro esquema (javascript:, data:, file:…)
  if (/\s/.test(raw) || !/^[^/]+\.[^/]{2,}/.test(raw)) return null;
  return `https://${raw}`;
}

/** Para exibir em href: devolve o link só se for http(s); senão undefined (sem link). */
export function safeHref(value) {
  return typeof value === 'string' && HTTP_RE.test(value.trim()) ? value.trim() : undefined;
}
