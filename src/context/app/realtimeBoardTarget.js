/**
 * Qual board um evento do Realtime (postgres_changes) afeta?
 * DELETE só traz a chave primária em `old`, então listas/cards/subtarefas apagados são achados
 * pelo id no estado local. Sem como saber (board/membro/convite novo) → null = recarregar tudo.
 */
export function resolveRealtimeBoardId(payload, boards = []) {
  const table = payload?.table;
  const row = payload?.new && Object.keys(payload.new).length ? payload.new : null;
  const old = payload?.old || {};

  const boardOfList = (listId) => boards.find((b) => b.lists?.some((l) => l.id === listId))?.id ?? null;
  const boardOfCard = (cardId) => boards.find((b) => b.lists?.some((l) => l.cards?.some((c) => c.id === cardId)))?.id ?? null;
  const boardOfSubtask = (subtaskId) => boards.find((b) => b.lists?.some((l) => l.cards?.some((c) => c.subtasks?.some((s) => s.id === subtaskId))))?.id ?? null;

  switch (table) {
    case 'boards': {
      const id = row?.id ?? old.id ?? null;
      // Board que ainda não está na tela (compartilhado agora): lista completa.
      return id && boards.some((b) => b.id === id) ? id : null;
    }
    case 'lists':
      return row?.board_id ?? old.board_id ?? boardOfList(old.id);
    case 'cards':
      return (row?.list_id && boardOfList(row.list_id)) || boardOfCard(row?.id ?? old.id);
    case 'subtasks':
      return (row?.card_id && boardOfCard(row.card_id)) || boardOfSubtask(row?.id ?? old.id);
    default:
      return null;
  }
}
