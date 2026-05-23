import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyBoardAction } from './boardApply.js';

const baseBoard = {
  id: 'b1',
  lists: [
    { id: 'l1', cards: [{ id: 'c1' }, { id: 'c2' }] },
    { id: 'l2', cards: [] },
  ],
};

describe('applyBoardAction MOVE_CARD', () => {
  it('resolve origem por cardId com estado já alterado', () => {
    const afterFirst = applyBoardAction(baseBoard, {
      type: 'MOVE_CARD',
      payload: {
        boardId: 'b1',
        sourceListId: 'l1',
        destListId: 'l2',
        sourceIndex: 0,
        destIndex: 0,
        cardId: 'c1',
      },
    });
    const afterSecond = applyBoardAction(afterFirst, {
      type: 'MOVE_CARD',
      payload: {
        boardId: 'b1',
        sourceListId: 'l1',
        destListId: 'l2',
        sourceIndex: 0,
        destIndex: 0,
        cardId: 'c2',
      },
    });
    const l1 = afterSecond.lists.find((l) => l.id === 'l1');
    const l2 = afterSecond.lists.find((l) => l.id === 'l2');
    assert.equal(l1.cards.length, 0);
    assert.equal(l2.cards.length, 2);
    assert.equal(l2.cards.length, 2);
    assert.ok(l2.cards.some((c) => c.id === 'c1'));
    assert.ok(l2.cards.some((c) => c.id === 'c2'));
  });
});

describe('applyBoardAction MOVE_LIST', () => {
  it('resolve origem por listId', () => {
    const board = {
      id: 'b1',
      lists: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    };
    const next = applyBoardAction(board, {
      type: 'MOVE_LIST',
      payload: {
        boardId: 'b1',
        listId: 'c',
        sourceIndex: 0,
        destIndex: 0,
      },
    });
    assert.deepEqual(next.lists.map((l) => l.id), ['c', 'a', 'b']);
  });
});

describe('applyBoardAction ADD_SUBTASK', () => {
  it('usa índice sequencial como position (compatível com integer do Postgres)', () => {
    const board = {
      id: 'b1',
      lists: [
        {
          id: 'l1',
          cards: [
            {
              id: 'c1',
              subtasks: [{ id: 'st0', title: 'A', done: false, position: 0 }],
            },
          ],
        },
      ],
    };
    const next = applyBoardAction(board, {
      type: 'ADD_SUBTASK',
      payload: { boardId: 'b1', listId: 'l1', cardId: 'c1', title: 'B' },
    });
    const subtasks = next.lists[0].cards[0].subtasks;
    assert.equal(subtasks.length, 2);
    assert.equal(subtasks[1].position, 1);
    assert.ok(subtasks[1].position < 2147483647);
  });
});

describe('applyBoardAction UPDATE_CARD', () => {
  it('atualiza updatedAt', () => {
    const card = baseBoard.lists[0].cards[0];
    const next = applyBoardAction(baseBoard, {
      type: 'UPDATE_CARD',
      payload: {
        boardId: 'b1',
        listId: 'l1',
        cardId: 'c1',
        updates: { title: 'Novo' },
      },
    });
    const updated = next.lists[0].cards.find((c) => c.id === 'c1');
    assert.equal(updated.title, 'Novo');
    assert.ok(updated.updatedAt);
  });
});
