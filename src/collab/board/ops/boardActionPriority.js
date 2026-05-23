const STRUCTURAL_ACTIONS = new Set([
  'ADD_CARD',
  'DELETE_CARD',
  'MOVE_CARD',
  'ADD_LIST',
  'DELETE_LIST',
  'MOVE_LIST',
]);

/** Só título/descrição podem esperar debounce curto. */
export function isTextOnlyCardUpdate(action) {
  if (action?.type !== 'UPDATE_CARD') return false;
  const updates = action.payload?.updates || {};
  const keys = Object.keys(updates);
  return keys.length > 0 && keys.every((k) => k === 'title' || k === 'description');
}

/** Concluído, mover, criar/apagar — precisam ir ao servidor e ao DB sem atraso. */
export function isImmediateBoardAction(action) {
  if (!action?.type) return false;
  if (STRUCTURAL_ACTIONS.has(action.type)) return true;
  if (action.type === 'UPDATE_CARD') {
    const updates = action.payload?.updates || {};
    if ('completed' in updates) return true;
    if ('listId' in updates) return true;
  }
  return false;
}

export function shouldDebounceBoardAction(action) {
  if (action?.type === 'UPDATE_SUBTASK') return true;
  return isTextOnlyCardUpdate(action);
}
