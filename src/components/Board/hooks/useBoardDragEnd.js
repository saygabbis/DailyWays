/** Fim do drag-and-drop do board (listas, cards, múltiplos cards e drops na sidebar: Meu Dia/Importante/Planejado). */
import { useCallback } from 'react';
import { useBoardSelectionStore } from '../../../stores/boardSelectionStore';
import { bulkMoveCardsToIndex, resolveSelectedCards } from '../boardCardBulkOps';

export function useBoardDragEnd(ctx) {
    const {
        state,
        getActiveBoard,
        setDroppedListId,
        collabDispatch,
        getBoardSnapshot,
    } = ctx;

    const handleDragEnd = useCallback((result) => {
        const b = getActiveBoard();
        if (!b) return;

        const { source, destination, type, draggableId } = result;
        if (!destination) return;

        const dragIdsFromStore = useBoardSelectionStore.getState().multiDragCardIds;
        const isMultiDrag = dragIdsFromStore.length > 1;

        if (
            !isMultiDrag
            && source.droppableId === destination.droppableId
            && source.index === destination.index
        ) {
            return;
        }

        // Handle List Reordering
        if (type === 'list') {
            const movedListId = b.lists[source.index]?.id;
            collabDispatch({
                type: 'MOVE_LIST',
                payload: {
                    boardId: b.id,
                    listId: movedListId,
                    sourceIndex: source.index,
                    destIndex: destination.index,
                    userId: state.user?.id
                }
            });
            // Anima a lista que foi solta
            if (movedListId) {
                setDroppedListId(movedListId);
                setTimeout(() => setDroppedListId(null), 900);
            }
            return;
        }

        // Handle Card Movement (use draggableId — indices break when list is filtered)
        const sourceList = b.lists.find(l => l.id === source.droppableId);
        const destList = b.lists.find(l => l.id === destination.droppableId);
        if (!sourceList || !destList) return;

        const cardId = draggableId;
        const dragIds = isMultiDrag ? dragIdsFromStore : [cardId];
        const cardsToMove = resolveSelectedCards(b, dragIds);

        if (cardsToMove.length > 1) {
            bulkMoveCardsToIndex(
                cardsToMove,
                destination.droppableId,
                destination.index,
                cardId,
                getActiveBoard,
                collabDispatch,
                getBoardSnapshot,
            );
            return;
        }

        const sourceIndex = sourceList.cards.findIndex((c) => c.id === cardId);
        if (sourceIndex < 0) return;

        const movedCard = sourceList.cards[sourceIndex];
        const destIndex = destination.index;

        collabDispatch({
            type: 'MOVE_CARD',
            payload: {
                boardId: b.id,
                cardId: movedCard.id,
                sourceListId: source.droppableId,
                destListId: destination.droppableId,
                sourceIndex,
                destIndex,
            },
        });

        if (destList?.isCompletionList && movedCard) {
            const allSubtasksDone = movedCard.subtasks?.every((st) => st.done);
            if (!movedCard.completed || !allSubtasksDone) {
                collabDispatch({
                    type: 'UPDATE_CARD',
                    payload: {
                        boardId: b.id,
                        listId: destination.droppableId,
                        cardId: movedCard.id,
                        updates: {
                            completed: true,
                            subtasks: (movedCard.subtasks || []).map((st) => ({ ...st, done: true })),
                        },
                    },
                });
            }
        }

    }, [getActiveBoard, collabDispatch, state.user?.id]);

    return {
        handleDragEnd,
    };
}
