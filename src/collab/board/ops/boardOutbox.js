/**
 * Fila de saída de ops de board + estado confirmado pelo servidor (UI otimista sem "valor velho").
 *
 * - `confirmed`: o board como o servidor collab tem (snapshot do join + ops aplicadas, na ordem
 *   do servidor).
 * - `pending`: ações locais ainda não confirmadas, na ordem em que foram feitas.
 * - O que a tela mostra = confirmed + pending (rebase). Uma op remota chega → aplica no
 *   confirmed e reaplica as pendentes por cima. Assim a última ação local nunca "pisca" para o
 *   valor antigo nem fica atrás de uma op remota mais velha, e todo mundo converge para a ordem
 *   do servidor quando a fila esvazia.
 *
 * Módulo puro (sem React/socket): testado em src/__tests__/boardOutbox.test.js.
 */
import { applyBoardAction } from '@dailyways/collab-protocol';

/** Ações de "editar campos" que podem ser fundidas enquanto ainda não foram enviadas. */
const MERGEABLE = new Set(['UPDATE_CARD', 'UPDATE_LIST', 'UPDATE_SUBTASK', 'UPDATE_BOARD']);

function mergeKey(action) {
  const p = action?.payload || {};
  switch (action?.type) {
    case 'UPDATE_CARD': return `card:${p.cardId}`;
    case 'UPDATE_LIST': return `list:${p.listId}`;
    case 'UPDATE_SUBTASK': return `subtask:${p.subtaskId}`;
    case 'UPDATE_BOARD': return `board:${p.id}`;
    default: return null;
  }
}

function canMerge(prev, next) {
  return !prev.sent
    && MERGEABLE.has(next.type)
    && prev.action.type === next.type
    && mergeKey(prev.action) === mergeKey(next);
}

export function createBoardOutbox() {
  /** @type {Map<string, any>} */
  const confirmed = new Map();
  /** @type {Map<string, Array<{ opId: string, action: any, sent: boolean, at: number }>>} */
  const pending = new Map();

  const list = (boardId) => {
    if (!pending.has(boardId)) pending.set(boardId, []);
    return pending.get(boardId);
  };

  const rebase = (boardId) => {
    const base = confirmed.get(boardId);
    if (!base) return null;
    return (pending.get(boardId) || []).reduce((b, e) => applyBoardAction(b, e.action), base);
  };

  return {
    hasConfirmed: (boardId) => confirmed.has(boardId),
    getConfirmed: (boardId) => confirmed.get(boardId) ?? null,
    pendingCount: (boardId) => pending.get(boardId)?.length ?? 0,
    pendingActions: (boardId) => (pending.get(boardId) || []).map((e) => e.action),
    boardsWithPending: () => [...pending.entries()].filter(([, q]) => q.length).map(([id]) => id),

    /** Snapshot do servidor (join/rejoin). Devolve o que a tela deve mostrar. */
    setConfirmed(boardId, board) {
      if (!boardId || !board) return null;
      confirmed.set(boardId, board);
      return rebase(boardId);
    },

    /** Saiu da sala: o confirmado deixa de ser atualizado (as pendentes seguem até sair). */
    dropConfirmed(boardId) {
      confirmed.delete(boardId);
    },

    /**
     * Ação local nova. Edições do mesmo card/lista/subtarefa ainda não enviadas viram uma só
     * (digitar, arrastar o seletor de cor…): menos ops, sem estourar o limite do servidor.
     * @returns {string} opId da entrada (nova ou fundida)
     */
    enqueue(boardId, action, opId) {
      const q = list(boardId);
      const last = q[q.length - 1];
      if (last && canMerge(last, action)) {
        const merged = action.type === 'UPDATE_BOARD'
          ? { ...action, payload: { ...action.payload, updates: { ...last.action.payload.updates, ...action.payload.updates } } }
          : { ...action, payload: { ...last.action.payload, ...action.payload, updates: { ...last.action.payload.updates, ...action.payload.updates } } };
        last.action = merged;
        last.at = Date.now();
        return last.opId;
      }
      q.push({ opId, action, sent: false, at: Date.now() });
      return opId;
    },

    /** Entradas ainda não enviadas (em ordem), já marcadas como enviadas. */
    takeUnsent(boardId) {
      const out = [];
      for (const e of pending.get(boardId) || []) {
        if (!e.sent) {
          e.sent = true;
          out.push(e);
        }
      }
      return out;
    },

    /** Envio falhou sem resposta (socket caiu, timeout, limite): volta para a fila. */
    markUnsent(boardId, opId) {
      const e = (pending.get(boardId) || []).find((x) => x.opId === opId);
      if (e) e.sent = false;
    },

    /** Reconectou: tudo que estava "em voo" é reenviado (o servidor ignora opId repetido). */
    resetSent(boardId) {
      for (const e of pending.get(boardId) || []) e.sent = false;
    },

    /**
     * op:applied do servidor (de qualquer um, na ordem do servidor).
     * @returns {{ board: any|null, own: boolean }} board = novo estado da tela quando precisa
     *   rebase (há pendentes) — null quando basta aplicar a ação direto no estado local.
     */
    applyServerOp(boardId, opId, action) {
      const base = confirmed.get(boardId);
      const q = pending.get(boardId) || [];
      const idx = q.findIndex((e) => e.opId === opId);
      const own = idx >= 0;
      if (base) confirmed.set(boardId, applyBoardAction(base, action));
      if (own) q.splice(idx, 1);
      if (!base) return { board: null, own };
      if (own) return { board: null, own };
      return { board: q.length ? rebase(boardId) : null, own };
    },

    /** Servidor disse "já tinha essa" (reenvio): o snapshot já a contém. */
    dropDuplicate(boardId, opId) {
      const q = pending.get(boardId) || [];
      const idx = q.findIndex((e) => e.opId === opId);
      if (idx >= 0) q.splice(idx, 1);
    },

    /** Servidor recusou de vez (validação/permissão): tira e devolve a tela sem ela. */
    reject(boardId, opId) {
      const q = pending.get(boardId) || [];
      const idx = q.findIndex((e) => e.opId === opId);
      if (idx < 0) return null;
      q.splice(idx, 1);
      return rebase(boardId);
    },

    /** Fallback do navegador assumiu (collab fora do ar): ele grava o board inteiro. */
    clearPending(boardId) {
      pending.delete(boardId);
    },
  };
}
