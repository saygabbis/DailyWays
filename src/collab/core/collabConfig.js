/**
 * Collab server URL.
 * - `auto` / empty / `proxy` / `same-origin`: mesmo host do app (Vite proxy em dev, nginx em prod)
 * - Produção com host separado: VITE_COLLAB_SERVER_URL=https://collab.seudominio.com
 */
export function getCollabServerUrl() {
  const raw = import.meta.env.VITE_COLLAB_SERVER_URL?.trim() ?? '';
  const useSameOrigin =
    !raw ||
    raw === 'auto' ||
    raw === 'proxy' ||
    raw === 'same-origin' ||
    raw === 'same';

  if (useSameOrigin && typeof window !== 'undefined') {
    return window.location.origin;
  }

  if (raw) return raw.replace(/\/$/, '');
  if (import.meta.env.DEV) {
    const devPort = import.meta.env.VITE_COLLAB_DEV_PORT || '2529';
    return `http://localhost:${devPort}`;
  }
  return '';
}

export function isCollabEnabled() {
  return Boolean(getCollabServerUrl());
}
