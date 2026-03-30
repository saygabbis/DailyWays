export function normalizeOrigin(input) {
  if (!input || typeof input !== 'string') return '';
  const trimmed = input.trim();
  if (!trimmed) return '';
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

export function getAppOrigin() {
  // Em produção, prefira configurar a URL pública explicitamente (ex.: http://IP:5174 ou https://dominio).
  // Isso evita depender do Host/Origin quando o app está atrás de proxy/rewrite.
  const env = normalizeOrigin(import.meta.env.VITE_PUBLIC_SITE_URL);
  if (env) return env;
  return normalizeOrigin(window.location.origin);
}

