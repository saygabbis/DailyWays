function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Applies a single AppContext-style board action to one board object (immutable).
 */
export function applyBoardAction(board, action) {
  if (!board || !action?.type) return board;

  switch (action.type) {
    case 'UPDATE_BOARD':
      if (board.id !== action.payload?.id) return board;
      return { ...board, ...action.payload.updates };

    case 'ADD_LIST': {
      if (board.id !== action.payload?.boardId) return board;
      const newList = {
        id: action.payload.id || newId(),
        title: action.payload.title || 'Nova Lista',
        color: null,
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

    case 'MOVE_LIST': {
      const { boardId, sourceIndex, destIndex, listId: movingListId } = action.payload || {};
      if (board.id !== boardId) return board;
      const newLists = [...board.lists];
      // Bug#1 fix: usa ID se disponível para localizar o item, evitando posição errada em ops concorrentes
      const resolvedSrcIdx = movingListId
        ? newLists.findIndex((l) => l.id === movingListId)
        : sourceIndex;
      if (resolvedSrcIdx < 0 || resolvedSrcIdx >= newLists.length) return board;
      const [moved] = newLists.splice(resolvedSrcIdx, 1);
      if (!moved) return board;
      const clampedDest = Math.min(destIndex, newLists.length);
      newLists.splice(clampedDest, 0, moved);
      return { ...board, lists: newLists };
    }

    case 'ADD_CARD': {
      const { boardId, listId, title, cardData } = action.payload || {};
      if (board.id !== boardId) return board;
      const now = new Date().toISOString();
      const newCard = {
        id: cardData?.id || newId(),
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
      };
      return {
        ...board,
        lists: board.lists.map((l) =>
          l.id === listId ? { ...l, cards: [...l.cards, newCard] } : l
        ),
      };
    }

    case 'UPDATE_CARD': {
      const { boardId, listId, cardId, updates } = action.payload || {};
      if (board.id !== boardId) return board;
      return {
        ...board,
        lists: board.lists.map((l) =>
          l.id === listId
            ? {
                ...l,
                cards: l.cards.map((c) =>
                  c.id === cardId ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
                ),
              }
            : l
        ),
      };
    }

    case 'DELETE_CARD': {
      const { boardId, listId, cardId } = action.payload || {};
      if (board.id !== boardId) return board;
      return {
        ...board,
        lists: board.lists.map((l) =>
          l.id === listId ? { ...l, cards: l.cards.filter((c) => c.id !== cardId) } : l
        ),
      };
    }

    case 'MOVE_CARD': {
      const { boardId, sourceListId, destListId, sourceIndex, destIndex, cardId: movingCardId } = action.payload || {};
      if (board.id !== boardId) return board;
      const newLists = board.lists.map((l) => ({ ...l, cards: [...l.cards] }));
      const sourceList = newLists.find((l) => l.id === sourceListId);
      const destList = newLists.find((l) => l.id === destListId);
      if (!sourceList || !destList) return board;
      // Bug#1 fix: usa ID se disponível para localizar o card, evitando posição errada em ops concorrentes
      const resolvedSrcIdx = movingCardId
        ? sourceList.cards.findIndex((c) => c.id === movingCardId)
        : sourceIndex;
      if (resolvedSrcIdx < 0) return board;
      const [movedCard] = sourceList.cards.splice(resolvedSrcIdx, 1);
      if (!movedCard) return board;
      const clampedDest = Math.min(destIndex, destList.cards.length);
      destList.cards.splice(clampedDest, 0, movedCard);
      return { ...board, lists: newLists };
    }

    case 'TOGGLE_SUBTASK': {
      const { boardId, listId, cardId, subtaskId } = action.payload || {};
      if (board.id !== boardId) return board;
      return {
        ...board,
        lists: board.lists.map((l) =>
          l.id === listId
            ? {
                ...l,
                cards: l.cards.map((c) =>
                  c.id === cardId
                    ? {
                        ...c,
                        subtasks: c.subtasks.map((st) =>
                          st.id === subtaskId ? { ...st, done: !st.done } : st
                        ),
                      }
                    : c
                ),
              }
            : l
        ),
      };
    }

    case 'ADD_SUBTASK': {
      const { boardId, listId, cardId, title, subtaskId } = action.payload || {};
      if (board.id !== boardId) return board;
      return {
        ...board,
        lists: board.lists.map((l) =>
          l.id === listId
            ? {
                ...l,
                cards: l.cards.map((c) => {
                  if (c.id !== cardId) return c;
                  const subtasks = c.subtasks ?? [];
                  const newSubtask = {
                    id: subtaskId || newId(),
                    title,
                    done: false,
                    position: subtasks.length,
                    linkUrl: null,
                    linkLabel: null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  };
                  return { ...c, subtasks: [...subtasks, newSubtask] };
                }),
              }
            : l
        ),
      };
    }

    case 'UPDATE_SUBTASK': {
      const { boardId, listId, cardId, subtaskId, updates } = action.payload || {};
      if (board.id !== boardId) return board;
      return {
        ...board,
        lists: board.lists.map((l) =>
          l.id === listId
            ? {
                ...l,
                cards: l.cards.map((c) =>
                  c.id === cardId
                    ? {
                        ...c,
                        subtasks: c.subtasks.map((st) =>
                          st.id === subtaskId ? { ...st, ...updates } : st
                        ),
                      }
                    : c
                ),
              }
            : l
        ),
      };
    }

    case 'DELETE_SUBTASK': {
      const { boardId, listId, cardId, subtaskId } = action.payload || {};
      if (board.id !== boardId) return board;
      return {
        ...board,
        lists: board.lists.map((l) =>
          l.id === listId
            ? {
                ...l,
                cards: l.cards.map((c) =>
                  c.id === cardId
                    ? { ...c, subtasks: c.subtasks.filter((st) => st.id !== subtaskId) }
                    : c
                ),
              }
            : l
        ),
      };
    }

    default:
      return board;
  }
}
