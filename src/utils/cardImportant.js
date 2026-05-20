/** Importante = priority high/urgent (campo `important` não existe no banco). */

export function isCardImportant(card) {
  return Boolean(
    card?.important
    || card?.priority === 'high'
    || card?.priority === 'urgent',
  );
}

export function updatesToggleImportant(card) {
  if (card?.priority === 'high' || card?.priority === 'urgent') {
    return { priority: 'none' };
  }
  return { priority: 'high' };
}
