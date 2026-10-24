import { describe, expect, it } from 'vitest';
import { boardStructuralFingerprint, countBoardCards, isStaleBoardSnapshot } from '../collab/board/sync/boardFingerprint.js';

const board = (lists) => ({ id: 'b', lists });
const local = board([{ id: 'l1', cards: [{ id: 'c1' }, { id: 'c2', completed: true }] }]);

describe('boardFingerprint', () => {
  it('ignora a ordem de listas/cards', () => {
    const shuffled = board([{ id: 'l1', cards: [{ id: 'c2', completed: true }, { id: 'c1' }] }]);
    expect(boardStructuralFingerprint(shuffled)).toBe(boardStructuralFingerprint(local));
    expect(countBoardCards(local)).toBe(2);
  });

  it('snapshot do servidor com menos cards é considerado velho', () => {
    expect(isStaleBoardSnapshot(local, board([{ id: 'l1', cards: [{ id: 'c1' }] }]))).toBe(true);
  });

  it('snapshot igual não é velho; boards diferentes nunca comparam', () => {
    expect(isStaleBoardSnapshot(local, local)).toBe(false);
    expect(isStaleBoardSnapshot(local, { ...local, id: 'outro' })).toBe(false);
  });
});
