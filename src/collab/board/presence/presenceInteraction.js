/** Variante visual do cursor remoto (default | pointer | grabbing). */
export function getPeerCursorVariant(peer) {
  if (peer?.draggingCardId || peer?.draggingListId) return 'grabbing';
  if (peer?.hoverCardId || peer?.hoverListId || peer?.hoverModalEl) return 'pointer';
  return 'default';
}
