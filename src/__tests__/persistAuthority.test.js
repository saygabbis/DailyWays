import { describe, expect, it } from 'vitest';
import { isBoardServerAuthoritative } from '../collab/board/sync/persistAuthority.js';

const live = { collabEnabled: true, boardId: 'b1', activeBoardId: 'b1', connected: true, roomLive: true };

describe('isBoardServerAuthoritative', () => {
  it('sala ao vivo do board ativo → servidor manda (navegador não grava o board inteiro)', () => {
    expect(isBoardServerAuthoritative(live)).toBe(true);
  });

  it.each([
    ['collab desligado', { collabEnabled: false }],
    ['socket caiu', { connected: false }],
    ['sala ainda não pronta', { roomLive: false }],
    ['outro board ativo', { activeBoardId: 'b2' }],
    ['sem boardId', { boardId: null }],
  ])('fallback pelo navegador quando: %s', (_label, patch) => {
    expect(isBoardServerAuthoritative({ ...live, ...patch })).toBe(false);
  });
});
