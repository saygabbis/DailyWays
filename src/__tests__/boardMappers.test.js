import { describe, expect, it } from 'vitest';
import {
  cardToRow,
  rowToCard,
  normalizePgIntPosition,
  isBoardOwnerClient,
  sortBoardMembersOwnerFirst,
  PG_INT_MAX,
} from '../services/boardMappers.js';

describe('boardMappers', () => {
  it('card ida e volta (app → linha → app) preserva os campos', () => {
    const card = {
      id: 'c1', title: 'Tarefa', description: 'd', priority: 'high', dueDate: '2026-10-30', startDate: null,
      isAllDay: false, recurrenceRule: 'weekly', myDay: true, dayCategory: 'essential', estimatedMinutes: 25,
      labels: ['blue'], color: '#fff', coverAttachmentId: null, completed: true,
      createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-02T00:00:00.000Z',
    };
    const row = cardToRow(card, 'l1', 3);
    expect(row).toMatchObject({ list_id: 'l1', position: 3, my_day: true, is_all_day: false, estimated_minutes: 25 });
    const back = rowToCard(row, []);
    for (const k of Object.keys(card)) expect(back[k]).toEqual(card[k]);
  });

  it('defaults seguros para card incompleto', () => {
    const row = cardToRow({ id: 'x' }, 'l');
    expect(row).toMatchObject({ title: 'Nova Tarefa', priority: 'none', labels: [], completed: false, is_all_day: true });
  });

  it('position fora do int do Postgres cai no índice', () => {
    expect(normalizePgIntPosition(Date.now(), 4)).toBe(4);
    expect(normalizePgIntPosition(-1, 2)).toBe(2);
    expect(normalizePgIntPosition('7.9', 0)).toBe(7);
    expect(normalizePgIntPosition(PG_INT_MAX, 0)).toBe(PG_INT_MAX);
  });

  it('dono: só pelo ownerId vindo do servidor; e vai para o topo da lista de membros', () => {
    expect(isBoardOwnerClient({ ownerId: 'u1' }, 'u1')).toBe(true);
    expect(isBoardOwnerClient({ ownerId: 'u1' }, 'u2')).toBe(false);
    expect(isBoardOwnerClient(null, 'u1')).toBe(false);
    const sorted = sortBoardMembersOwnerFirst([{ userId: 'a', role: 'editor' }, { userId: 'o', role: 'reader' }], 'o');
    expect(sorted[0].userId).toBe('o');
  });
});
