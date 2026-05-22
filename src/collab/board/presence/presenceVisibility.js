/** Utilizador com o cursor na superfície do board (sem overlay / fora da área). */
export function isPeerOnBoardSurface(peer) {
  if (peer?.onBoardSurface === false) return false;
  return !peer?.selectedCardId;
}

/** Utilizador na mesma task/modal que `cardId`. */
export function isPeerInTaskModal(peer, cardId) {
  if (!cardId || !peer?.selectedCardId) return false;
  return peer.selectedCardId === cardId;
}

/** Overlay do board (lista, etc.) sem modal de task — cursor em viewport. */
export function isPeerInBoardOverlay(peer) {
  if (peer?.onBoardSurface !== false) return false;
  return !peer?.selectedCardId;
}
