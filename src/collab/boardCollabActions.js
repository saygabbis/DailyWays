/** Helpers para ações do reducer — sempre via collabDispatchForBoard. */

export function updateBoardMetaAction(boardId, updates) {
  return { type: 'UPDATE_BOARD', payload: { id: boardId, updates } };
}

export function updateCardAction(boardId, listId, cardId, updates) {
  return {
    type: 'UPDATE_CARD',
    payload: { boardId, listId, cardId, updates },
  };
}

export function deleteCardAction(boardId, listId, cardId) {
  return { type: 'DELETE_CARD', payload: { boardId, listId, cardId } };
}
