/**
 * Quem grava o board no Supabase?
 *
 * Com a sala de collab do board ao vivo, o servidor collab é a fonte da verdade e persiste
 * sozinho. O navegador NÃO pode mandar o board inteiro: `upsert_board_full` apaga tudo o que
 * não está no payload, então uma aba desatualizada apagaria edições de outras pessoas.
 * O save pelo navegador fica só como fallback (collab desligado, sem socket ou fora da sala).
 */
export function isBoardServerAuthoritative({ collabEnabled, boardId, activeBoardId, connected, roomLive }) {
  return Boolean(collabEnabled && boardId && activeBoardId === boardId && connected && roomLive);
}
