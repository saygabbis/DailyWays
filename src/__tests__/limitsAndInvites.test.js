import { describe, expect, it } from 'vitest';
import { LIMIT_ERROR, TEXT } from '@dailyways/limits';
import { LIMIT_MSG, resolveLimitError } from '../limits/messages.js';
import { looksLikeEmail, normalizeInviteIdentifier } from '../utils/inviteIdentifier.js';

describe('resolveLimitError', () => {
  it('ok → string vazia; sem resultado → genérico', () => {
    expect(resolveLimitError({ ok: true })).toBe('');
    expect(resolveLimitError(null)).toBe('Limite excedido.');
  });

  it('texto longo usa a mensagem do campo', () => {
    expect(resolveLimitError({ code: LIMIT_ERROR.TEXT_TOO_LONG, field: 'cardTitle' })).toBe(LIMIT_MSG.cardTitle);
    expect(LIMIT_MSG.cardTitle).toContain(String(TEXT.cardTitle));
  });
});

describe('convites', () => {
  it('normaliza @username e preserva email', () => {
    expect(normalizeInviteIdentifier('  @Gabbis ')).toBe('gabbis');
    expect(normalizeInviteIdentifier('a@b.com')).toBe('a@b.com');
    expect(looksLikeEmail('a@b.com')).toBe(true);
    expect(looksLikeEmail('@gabbis')).toBe(false);
  });
});
