/** Fingerprint estrutural (listas + cards + completed) para evitar UPDATE_BOARD redundante. */
export function boardStructuralFingerprint(board) {
  if (!board?.lists?.length) return '';
  return board.lists
    .map((list) => {
      const cards = (list.cards || [])
        .map((c) => `${c.id}:${c.completed ? 1 : 0}`)
        .sort()
        .join(',');
      return `${list.id}[${cards}]`;
    })
    .sort()
    .join(';');
}

export function countBoardCards(board) {
  if (!board?.lists?.length) return 0;
  return board.lists.reduce((n, list) => n + (list.cards?.length || 0), 0);
}

/** Snapshot do servidor não pode apagar cards que ainda existem localmente. */
export function isStaleBoardSnapshot(localBoard, serverBoard) {
  if (!localBoard || !serverBoard || localBoard.id !== serverBoard.id) return false;
  return countBoardCards(serverBoard) < countBoardCards(localBoard);
}