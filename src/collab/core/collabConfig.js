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

/**
 * Retorna true para localhost, 127.0.0.1 e qualquer IP de rede privada LAN.
 * Espelha a lógica de `isPrivateLanOrigin` do backend (socketHandlers).
 * Amigos na mesma rede local devem usar WebSocket, não polling.
 */
export function isLocalOrLanHost() {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return /^(localhost|127\.0\.0\.1|::1|0\.0\.0\.0)$/.test(h)
    || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)
    || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)
    || /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(h);
}

export function isCollabEnabled() {
  return Boolean(getCollabServerUrl());
}
