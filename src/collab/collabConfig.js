/**
 * Collab server URL.
 * - DEV + `auto` / empty / `proxy`: same origin → Vite proxies /socket.io → localhost:2525
 * - LAN: friend opens http://YOUR_LAN_IP:5174 — both use that origin automatically
 * - Production: set VITE_COLLAB_SERVER_URL to your collab host (e.g. https://collab.example.com)
 */
export function getCollabServerUrl() {
  const raw = import.meta.env.VITE_COLLAB_SERVER_URL?.trim() ?? '';

  if (import.meta.env.DEV) {
    const useProxy =
      !raw ||
      raw === 'auto' ||
      raw === 'proxy' ||
      raw === 'same-origin' ||
      raw === 'same';
    if (useProxy && typeof window !== 'undefined') {
      return window.location.origin;
    }
  }

  if (raw) return raw.replace(/\/$/, '');
  if (import.meta.env.DEV) return 'http://localhost:2525';
  return '';
}

export function isCollabEnabled() {
  return Boolean(getCollabServerUrl());
}
