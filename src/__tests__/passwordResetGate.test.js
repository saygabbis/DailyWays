import { describe, expect, it } from 'vitest';
import { detectPasswordRecovery, isPendingResetValid } from '../app/passwordResetGate.js';

describe('detectPasswordRecovery', () => {
  it('link do Supabase com type=recovery e token', () => {
    expect(detectPasswordRecovery('', '?type=recovery&token=abc').isPasswordRecovery).toBe(true);
  });
  it('tokens no hash + palavra recovery', () => {
    const r = detectPasswordRecovery('#access_token=a&refresh_token=b&type=recovery', '');
    expect(r).toEqual({ isPasswordRecovery: true, urlHasAccessRefresh: true });
  });
  it('login OAuth comum (tokens sem recovery) não força a tela', () => {
    const r = detectPasswordRecovery('#access_token=a&refresh_token=b', '');
    expect(r).toEqual({ isPasswordRecovery: false, urlHasAccessRefresh: true });
  });
  it('navegação normal', () => {
    expect(detectPasswordRecovery('', '').isPasswordRecovery).toBe(false);
  });
});

describe('isPendingResetValid', () => {
  const store = (flag, ts) => (k) => ({ dailyways_pw_reset_pending: flag, dailyways_pw_reset_pending_ts: ts }[k] ?? null);
  it('válido por 10 minutos', () => {
    const now = 1_000_000_000;
    expect(isPendingResetValid(now, store('1', String(now - 60_000)))).toBe(true);
    expect(isPendingResetValid(now, store('1', String(now - 11 * 60_000)))).toBe(false);
    expect(isPendingResetValid(now, store(null, String(now)))).toBe(false);
  });
});
