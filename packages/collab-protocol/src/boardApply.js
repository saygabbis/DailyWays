function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Onde o card está AGORA (o listId da ação pode estar velho se alguém moveu o card). */
function locateCard(board, cardId, hintListId) {
  if (!cardId || !board?.lists) return null;
  const hinted = hintListId ? board.lists.find((l) => l.id === hintListId) : null;
  if (hinted?.cards?.some((c) => c.id === cardId)) return hinted.id;
  const found = board.lists.find((l) => (l.cards || []).some((c) => c.id === cardId));
  return found ? found.id : null;
}

function findCard(board, cardId, hintListId) {
  const listId = locateCard(board, cardId, hintListId);
  if (!listId) return null;
  return board.lists.find((l) => l.id === listId).cards.find((c) => c.id === cardId);
}

/** Aplica `fn` ao card `cardId`, onde quer que ele esteja. Sem o card, devolve o board igual. */
function mapCard(board, cardId, hintListId, fn) {
  const listId = locateCard(board, cardId, hintListId);
  if (!listId) return board;
  return {
    ...board,
    lists: board.lists.map((l) =>
      l.id === listId
        ? { ...l, cards: l.cards.map((c) => (c.id === cardId ? fn(c) : c)) }
        : l
    ),
  };
}

function mapSubtask(board, cardId, hintListId, subtaskId, fn) {
  return mapCard(board, cardId, hintListId, (c) => ({
    ...c,
    subtasks: (c.subtasks || []).map((st) => (st.id === subtaskId ? fn(st) : st)),
  }));
}

/** Board que a ação altera (UPDATE_BOARD usa payload.id; o resto, payload.boardId). */
export function boardActionTargetId(action) {
  if (!action?.payload) return null;
  return action.type === 'UPDATE_BOARD' ? action.payload.id ?? null : action.payload.boardId ?? null;
}

/** Campos do board que uma op pode mudar (pasta/posição/dono são de cada usuário ou do banco). */
export const BOARD_META_FIELDS = new Set(['title', 'emoji', 'color']);

/** Chaves que nenhuma op pode sobrescrever por `updates` (identidade e estrutura). */
const FORBIDDEN_UPDATE_KEYS = {
  UPDATE_CARD: new Set(['id']),
  UPDATE_LIST: new Set(['id', 'cards']),
  UPDATE_SUBTASK: new Set(['id']),
};

/**
 * Tira da ação o que ela não pode mudar. Aplicado no cliente E no servidor, para os dois lados
 * chegarem no mesmo resultado (antes um UPDATE_BOARD podia trocar `lists` inteiras ou o `id`).
 */
export function sanitizeBoardAction(action) {
  if (!action?.type || !action.payload) return action;
  const p = action.payload;
  if (action.type === 'UPDATE_BOARD') {
    const updates = {};
    for (const [k, v] of Object.entries(p.updates || {})) {
      if (BOARD_META_FIELDS.has(k)) updates[k] = v;
    }
    return { ...action, payload: { ...p, updates } };
  }
  const forbidden = FORBIDDEN_UPDATE_KEYS[action.type];
  if (forbidden && p.updates && Object.keys(p.updates).some((k) => forbidden.has(k))) {
    const updates = Object.fromEntries(Object.entries(p.updates).filter(([k]) => !forbidden.has(k)));
    return { ...action, payload: { ...p, updates } };
  }
  return action;
}

/**
 * Completa a ação ANTES de aplicar e enviar, para que cliente e servidor cheguem no mesmo estado:
 * - ids de lista/card/subtarefa novos (sem isso cada lado sorteava o seu);
 * - carimbo de tempo do UPDATE_CARD;
 * - TOGGLE_SUBTASK vira "marcar como X" (duas pessoas clicando juntas não se anulam).
 * Idempotente: normalizar duas vezes dá o mesmo resultado.
 */
export function normalizeBoardAction(action, board) {
  if (!action?.type || !action.payload) return action;
  const p = action.payload;
  switch (action.type) {
    case 'ADD_LIST':
      return p.id ? action : { ...action, payload: { ...p, id: newId() } };
    case 'ADD_CARD':
      return p.cardData?.id
        ? action
        : { ...action, payload: { ...p, cardData: { ...(p.cardData || {}), id: newId() } } };
    case 'ADD_SUBTASK': {
      const now = new Date().toISOString();
      return p.subtaskId && p.createdAt
        ? action
        : { ...action, payload: { ...p, subtaskId: p.subtaskId || newId(), createdAt: p.createdAt || now } };
    }
    case 'UPDATE_CARD':
      return p.updatedAt ? action : { ...action, payload: { ...p, updatedAt: new Date().toISOString() } };
    case 'TOGGLE_SUBTASK': {
      if (typeof p.done === 'boolean') return action;
      const card = findCard(board, p.cardId, p.listId);
      const st = card?.subtasks?.find((s) => s.id === p.subtaskId);
      return { ...action, payload: { ...p, done: !st?.done } };
    }
    default:
      return action;
  }
}

/**
 * Applies a single AppContext-style board action to one board object (immutable).
 * Cards e subtarefas são localizados pelo id (o listId da ação é só uma dica): uma edição feita
 * enquanto outra pessoa movia o card não se perde mais.
 */
export function applyBoardAction(board, action) {
  if (!board || !action?.type) return board;

  switch (action.type) {
    case 'UPDATE_BOARD':
      if (board.id !== action.payload?.id) return board;
      return { ...board, ...action.payload.updates };

    case 'ADD_LIST': {
      if (board.id !== action.payload?.boardId) return board;
      const id = action.payload.id || newId();
      if (board.lists.some((l) => l.id === id)) return board;
      const newList = {
        id,
        title: action.payload.title || 'Nova Lista',
        color: action.payload.color ?? null,
        isCompletionList: false,
        cards: [],
      };
      return { ...board, lists: [...board.lists, newList] };
    }

    case 'UPDATE_LIST':
      if (board.id !== action.payload?.boardId) return board;
      return {
        ...board,
        lists: board.lists.map((l) =>
          l.id === action.payload.listId ? { ...l, ...action.payload.updates } : l
        ),
      };

    case 'DELETE_LIST':
      if (board.id !== action.payload?.boardId) return board;
      return {
        ...board,
        lists: board.lists.filter((l) => l.id !== action.payload.listId),
      };

    case 'REORDER_LIST_CARDS': {
      // Nova ordem dos cards de uma lista (ex.: ordenar por prioridade). Ids desconhecidos são
      // ignorados; cards que não vieram na lista (alguém acabou de criar) ficam no fim.
      const { boardId, listId, cardIds } = action.payload || {};
      if (board.id !== boardId || !Array.isArray(cardIds)) return board;
      return {
        ...board,
        lists: board.lists.map((l) => {
          if (l.id !== listId) return l;
          const byId = new Map(l.cards.map((c) => [c.id, c]));
          const ordered = cardIds.map((id) => byId.get(id)).filter(Boolean);
          const seen = new Set(ordered.map((c) => c.id));
          return { ...l, cards: [...ordered, ...l.cards.filter((c) => !seen.has(c.id))] };
        }),
      };
    }

    case 'MOVE_LIST': {
      const { boardId, sourceIndex, destIndex, listId: movingListId } = action.payload || {};
      if (board.id !== boardId) return board;
      const newLists = [...board.lists];
      const resolvedSrcIdx = movingListId
        ? newLists.findIndex((l) => l.id === movingListId)
        : sourceIndex;
      if (resolvedSrcIdx < 0 || resolvedSrcIdx >= newLists.length) return board;
      const [moved] = newLists.splice(resolvedSrcIdx, 1);
      if (!moved) return board;
      const clampedDest = Math.max(0, Math.min(destIndex, newLists.length));
      newLists.splice(clampedDest, 0, moved);
      return { ...board, lists: newLists };
    }

    case 'ADD_CARD': {
      const { boardId, listId, title, cardData } = action.payload || {};
      if (board.id !== boardId) return board;
      const id = cardData?.id || newId();
      if (findCard(board, id)) return board;
      if (!board.lists.some((l) => l.id === listId)) return board;
      const now = cardData?.createdAt || new Date().toISOString();
      const newCard = {
        title: title || 'Nova Tarefa',
        description: '',
        labels: [],
        priority: 'none',
        dueDate: null,
        startDate: null,
        isAllDay: true,
        recurrenceRule: null,
        coverAttachmentId: null,
        myDay: false,
        subtasks: [],
        createdAt: now,
        updatedAt: now,
        ...cardData,
        id,
      };
      return {
        ...board,
        lists: board.lists.map((l) =>
          l.id === listId ? { ...l, cards: [...l.cards, newCard] } : l
        ),
      };
    }

    case 'UPDATE_CARD': {
      const { boardId, listId, cardId, updates, updatedAt } = action.payload || {};
      if (board.id !== boardId) return board;
      const stamp = updatedAt || new Date().toISOString();
      return mapCard(board, cardId, listId, (c) => ({ ...c, ...updates, updatedAt: stamp }));
    }

    case 'DELETE_CARD': {
      const { boardId, listId, cardId } = action.payload || {};
      if (board.id !== boardId) return board;
      const at = locateCard(board, cardId, listId);
      if (!at) return board;
      return {
        ...board,
        lists: board.lists.map((l) =>
          l.id === at ? { ...l, cards: l.cards.filter((c) => c.id !== cardId) } : l
        ),
      };
    }

    case 'MOVE_CARD': {
      const { boardId, sourceListId, destListId, sourceIndex, destIndex, cardId: movingCardId } = action.payload || {};
      if (board.id !== boardId) return board;
      const newLists = board.lists.map((l) => ({ ...l, cards: [...l.cards] }));
      const resolvedSourceId = movingCardId ? locateCard(board, movingCardId, sourceListId) : sourceListId;
      const sourceList = newLists.find((l) => l.id === resolvedSourceId);
      const destList = newLists.find((l) => l.id === destListId);
      if (!sourceList || !destList) return board;
      const resolvedSrcIdx = movingCardId
        ? sourceList.cards.findIndex((c) => c.id === movingCardId)
        : sourceIndex;
      if (resolvedSrcIdx < 0) return board;
      const [movedCard] = sourceList.cards.splice(resolvedSrcIdx, 1);
      if (!movedCard) return board;
      const clampedDest = Math.max(0, Math.min(destIndex ?? destList.cards.length, destList.cards.length));
      destList.cards.splice(clampedDest, 0, movedCard);
      return { ...board, lists: newLists };
    }

    case 'TOGGLE_SUBTASK': {
      const { boardId, listId, cardId, subtaskId, done } = action.payload || {};
      if (board.id !== boardId) return board;
      return mapSubtask(board, cardId, listId, subtaskId, (st) => ({
        ...st,
        done: typeof done === 'boolean' ? done : !st.done,
      }));
    }

    case 'ADD_SUBTASK': {
      const { boardId, listId, cardId, title, subtaskId, createdAt } = action.payload || {};
      if (board.id !== boardId) return board;
      return mapCard(board, cardId, listId, (c) => {
        const subtasks = c.subtasks ?? [];
        const id = subtaskId || newId();
        if (subtasks.some((st) => st.id === id)) return c;
        const now = createdAt || new Date().toISOString();
        const newSubtask = {
          id,
          title,
          done: false,
          position: subtasks.length,
          linkUrl: null,
          linkLabel: null,
          createdAt: now,
          updatedAt: now,
        };
        return { ...c, subtasks: [...subtasks, newSubtask] };
      });
    }

    case 'UPDATE_SUBTASK': {
      const { boardId, listId, cardId, subtaskId, updates } = action.payload || {};
      if (board.id !== boardId) return board;
      return mapSubtask(board, cardId, listId, subtaskId, (st) => ({ ...st, ...updates }));
    }

    case 'DELETE_SUBTASK': {
      const { boardId, listId, cardId, subtaskId } = action.payload || {};
      if (board.id !== boardId) return board;
      return mapCard(board, cardId, listId, (c) => ({
        ...c,
        subtasks: (c.subtasks || []).filter((st) => st.id !== subtaskId),
      }));
    }

    default:
      return board;
  }
}
