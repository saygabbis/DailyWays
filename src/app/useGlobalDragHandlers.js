/**
 * Depois de soltar um card em "Planejado" (sidebar), o popover pede a data; aqui ela é gravada.
 * O arrastar em si fica em src/dnd (DndProvider) e nos handlers do board e da sidebar.
 */
export function useGlobalDragHandlers({ collabDispatch, plannedDropCard, setPlannedDropCard }) {
  const handlePlannedDateSelect = (date) => {
    if (!plannedDropCard) return;
    const { boardId, listId, card } = plannedDropCard;
    collabDispatch({
      type: 'UPDATE_CARD',
      payload: { boardId, listId, cardId: card.id, updates: { dueDate: date } },
    });
    setPlannedDropCard(null);
  };

  return { handlePlannedDateSelect };
}
