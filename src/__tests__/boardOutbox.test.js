import { describe, expect, it } from 'vitest';
import { applyBoardAction, normalizeBoardAction } from '@dailyways/collab-protocol';
import { createBoardOutbox } from '../collab/board/ops/boardOutbox.js';

const board = () => ({
  id: 'b1',
  lists: [
    { id: 'l1', cards: [{ id: 'c1', title: 'A', color: null, subtasks: [{ id: 's1', done: false }] }] },
    { id: 'l2', cards: [] },
  ],
});

const color = (c, opts = {}) => ({
  type: 'UPDATE_CARD',
  payload: { boardId: 'b1', listId: 'l1', cardId: 'c1', updates: { color: c }, updatedAt: opts.at ?? 't' },
});
const card = (b) => b.lists.flatMap((l) => l.cards).find((c) => c.id === 'c1');

describe('boardOutbox', () => {
  it('op remota mais velha não "desfaz" a edição local pendente (cor pisca entre antiga e nova)', () => {
    const ob = createBoardOutbox();
    ob.setConfirmed('b1', board());
    ob.enqueue('b1', color('red'), 'mine');
    ob.takeUnsent('b1');
    // Servidor aplicou primeiro a op de outra pessoa (azul), depois a minha (vermelho).
    const remote = ob.applyServerOp('b1', 'other', color('blue'));
    expect(card(remote.board).color).toBe('red');
    const own = ob.applyServerOp('b1', 'mine', color('red'));
    expect(own.own).toBe(true);
    expect(card(ob.getConfirmed('b1')).color).toBe('red');
    expect(ob.pendingCount('b1')).toBe(0);
  });

  it('funde edições do mesmo card ainda não enviadas (seletor de cor arrastado)', () => {
    const ob = createBoardOutbox();
    ob.setConfirmed('b1', board());
    const a = ob.enqueue('b1', color('#111'), 'op1');
    const b = ob.enqueue('b1', color('#222'), 'op2');
    const c = ob.enqueue('b1', color('#333'), 'op3');
    expect(new Set([a, b, c]).size).toBe(1);
    const sent = ob.takeUnsent('b1');
    expect(sent).toHaveLength(1);
    expect(sent[0].action.payload.updates.color).toBe('#333');
    // Depois de enviada, a próxima edição vira outra op.
    expect(ob.enqueue('b1', color('#444'), 'op4')).toBe('op4');
  });

  it('não funde campos de cards diferentes nem ações estruturais', () => {
    const ob = createBoardOutbox();
    ob.setConfirmed('b1', board());
    ob.enqueue('b1', color('red'), 'op1');
    ob.enqueue('b1', { type: 'MOVE_CARD', payload: { boardId: 'b1', cardId: 'c1', sourceListId: 'l1', destListId: 'l2', destIndex: 0 } }, 'op2');
    ob.enqueue('b1', color('blue'), 'op3');
    expect(ob.pendingCount('b1')).toBe(3);
  });

  it('rejoin: snapshot novo + pendentes por cima; reenvio duplicado sai da fila', () => {
    const ob = createBoardOutbox();
    ob.setConfirmed('b1', board());
    ob.enqueue('b1', color('green'), 'g');
    ob.takeUnsent('b1');
    ob.resetSent('b1');
    const snap = board();
    snap.lists[0].cards[0].title = 'renomeado por outra pessoa';
    const shown = ob.setConfirmed('b1', snap);
    expect(card(shown)).toMatchObject({ title: 'renomeado por outra pessoa', color: 'green' });
    expect(ob.takeUnsent('b1')).toHaveLength(1);
    ob.dropDuplicate('b1', 'g');
    expect(ob.pendingCount('b1')).toBe(0);
  });

  it('recusa do servidor devolve a tela sem a ação', () => {
    const ob = createBoardOutbox();
    ob.setConfirmed('b1', board());
    ob.enqueue('b1', color('red'), 'x');
    expect(card(ob.reject('b1', 'x')).color).toBe(null);
  });
});

describe('protocolo: ações por id (edição concorrente com mover card)', () => {
  it('UPDATE_CARD com listId velho ainda acha o card que outra pessoa moveu', () => {
    const moved = applyBoardAction(board(), {
      type: 'MOVE_CARD',
      payload: { boardId: 'b1', cardId: 'c1', sourceListId: 'l1', destListId: 'l2', destIndex: 0 },
    });
    const next = applyBoardAction(moved, color('pink'));
    expect(next.lists[1].cards[0].color).toBe('pink');
  });

  it('TOGGLE_SUBTASK normalizado vira "marcar como" (dois cliques juntos não se anulam)', () => {
    const toggle = normalizeBoardAction(
      { type: 'TOGGLE_SUBTASK', payload: { boardId: 'b1', listId: 'l1', cardId: 'c1', subtaskId: 's1' } },
      board(),
    );
    expect(toggle.payload.done).toBe(true);
    const twice = applyBoardAction(applyBoardAction(board(), toggle), toggle);
    expect(twice.lists[0].cards[0].subtasks[0].done).toBe(true);
  });

  it('ADD_CARD/ADD_LIST sem id ganham id antes de sair (cliente e servidor com o mesmo id)', () => {
    const add = normalizeBoardAction({ type: 'ADD_CARD', payload: { boardId: 'b1', listId: 'l2', title: 'x' } }, board());
    expect(add.payload.cardData.id).toBeTruthy();
    const a = applyBoardAction(board(), add);
    const b = applyBoardAction(board(), add);
    expect(a.lists[1].cards[0].id).toBe(b.lists[1].cards[0].id);
    // aplicar duas vezes (reenvio) não duplica
    expect(applyBoardAction(a, add).lists[1].cards).toHaveLength(1);
  });
});
