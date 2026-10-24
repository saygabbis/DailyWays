import { describe, expect, it } from 'vitest';
import { resolveRealtimeBoardId } from '../context/app/realtimeBoardTarget.js';

const boards = [
  { id: 'b1', lists: [{ id: 'l1', cards: [{ id: 'c1', subtasks: [{ id: 's1' }] }] }] },
  { id: 'b2', lists: [{ id: 'l2', cards: [] }] },
];

describe('resolveRealtimeBoardId', () => {
  it('acha o board pelo pai da linha (insert/update)', () => {
    expect(resolveRealtimeBoardId({ table: 'lists', new: { id: 'lx', board_id: 'b2' } }, boards)).toBe('b2');
    expect(resolveRealtimeBoardId({ table: 'cards', new: { id: 'cx', list_id: 'l1' } }, boards)).toBe('b1');
    expect(resolveRealtimeBoardId({ table: 'subtasks', new: { id: 'sx', card_id: 'c1' } }, boards)).toBe('b1');
  });

  it('DELETE (só a chave em old) é achado pelo id no estado local', () => {
    expect(resolveRealtimeBoardId({ table: 'cards', new: {}, old: { id: 'c1' } }, boards)).toBe('b1');
    expect(resolveRealtimeBoardId({ table: 'subtasks', new: {}, old: { id: 's1' } }, boards)).toBe('b1');
    expect(resolveRealtimeBoardId({ table: 'lists', new: {}, old: { id: 'l2' } }, boards)).toBe('b2');
  });

  it('sem como saber (membro, convite, board novo) → recarrega tudo', () => {
    expect(resolveRealtimeBoardId({ table: 'board_members', new: { board_id: 'b1' } }, boards)).toBe(null);
    expect(resolveRealtimeBoardId({ table: 'boards', new: { id: 'novo' } }, boards)).toBe(null);
    expect(resolveRealtimeBoardId({ table: 'cards', new: { id: 'cz', list_id: 'lista-desconhecida' } }, boards)).toBe(null);
  });
});
