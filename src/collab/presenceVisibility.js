/** Utilizador com o cursor na superfície do board (não dentro de overlay de task). */
export function isPeerOnBoardSurface(peer) {
  return !peer?.selectedCardId;
}

/** Utilizador na mesma task/modal que `cardId`. */
export function isPeerInTaskModal(peer, cardId) {
  if (!cardId || !peer?.selectedCardId) return false;
  return peer.selectedCardId === cardId;
}
