/**
 * Decide se o app deve abrir direto a tela de "nova senha" (link de recuperação do Supabase).
 * Segurança + UX:
 *  1) URL explicitamente de recovery (`type=recovery` + token, ou tokens + palavra "recovery") → abre.
 *  2) Tokens na URL e um reset iniciado aqui há < 10 min (flag no localStorage) → abre
 *     (alguns redirects chegam sem `type=recovery`).
 *  3) Navegação normal, sem tokens na URL → nunca força; a flag velha é limpa.
 */
import { useEffect } from 'react';

const PENDING_KEY = 'dailyways_pw_reset_pending';
const PENDING_TS_KEY = 'dailyways_pw_reset_pending_ts';
const PENDING_MAX_AGE_MS = 10 * 60 * 1000;

/** Função pura: analisa hash/search da URL. */
export function detectPasswordRecovery(hash = '', search = '') {
  const combined = `${hash}&${search}`.toLowerCase();
  const searchParams = new URLSearchParams(search);
  const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const type = (searchParams.get('type') || hashParams.get('type') || '').toLowerCase();
  const token = searchParams.get('token') || hashParams.get('token');
  const urlHasAccessRefresh = combined.includes('access_token') && combined.includes('refresh_token');
  const isPasswordRecovery = (type === 'recovery' && !!token)
    || (urlHasAccessRefresh && (type === 'recovery' || combined.includes('recovery')));
  return { isPasswordRecovery, urlHasAccessRefresh };
}

function readStorage(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

/** Reset iniciado neste navegador há menos de 10 min. */
export function isPendingResetValid(now = Date.now(), read = readStorage) {
  if (read(PENDING_KEY) !== '1') return false;
  const ts = Number(read(PENDING_TS_KEY) || '0');
  return !!ts && now - ts < PENDING_MAX_AGE_MS;
}

export function usePasswordResetGate() {
  const { isPasswordRecovery, urlHasAccessRefresh } = detectPasswordRecovery(
    window.location.hash || '',
    window.location.search || '',
  );
  const pending = readStorage(PENDING_KEY) === '1';
  const pendingValid = isPendingResetValid();

  // Flag que não virou recovery real (ou expirou) não pode "prender" o login normal.
  useEffect(() => {
    if (!pending || isPasswordRecovery || urlHasAccessRefresh) return;
    try {
      window.localStorage.removeItem(PENDING_KEY);
      window.localStorage.removeItem(PENDING_TS_KEY);
    } catch { /* storage indisponível */ }
  }, [pending, isPasswordRecovery, urlHasAccessRefresh]);

  return isPasswordRecovery || (pendingValid && urlHasAccessRefresh);
}
