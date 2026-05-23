import { uuidv4 } from '../../utils/uuid';

export function serializeCardForClipboard(card) {
    return JSON.parse(JSON.stringify(card));
}

export function buildDuplicateCardPayload(card, listId, boardId) {
    return {
        type: 'ADD_CARD',
        payload: {
            boardId,
            listId,
            cardData: {
                id: uuidv4(),
                title: `${card.title} (cópia)`,
                description: card.description,
                labels: [...(card.labels || [])],
                priority: card.priority,
                dueDate: card.dueDate,
                startDate: card.startDate,
                isAllDay: card.isAllDay ?? true,
                recurrenceRule: card.recurrenceRule ?? null,
                coverAttachmentId: card.coverAttachmentId ?? null,
                myDay: false,
                subtasks: (card.subtasks || []).map((st, index) => ({
                    id: uuidv4(),
                    title: st.title,
                    done: false,
                    position: st.position ?? index,
                    linkUrl: st.linkUrl ?? null,
                    linkLabel: st.linkLabel ?? null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                })),
            },
        },
    };
}

export function buildPasteCardPayload(card, listId, boardId) {
    const copy = serializeCardForClipboard(card);
    return {
        type: 'ADD_CARD',
        payload: {
            boardId,
            listId,
            cardData: {
                ...copy,
                id: uuidv4(),
                subtasks: (copy.subtasks || []).map((st, index) => ({
                    ...st,
                    id: uuidv4(),
                    position: st.position ?? index,
                })),
            },
        },
    };
}

export function resolveSelectedCards(board, selectedCardIds) {
    if (!board?.lists?.length || !selectedCardIds?.length) return [];
    const idSet = new Set(selectedCardIds);
    const ordered = [];
    for (const list of board.lists) {
        for (const card of list.cards) {
            if (idSet.has(card.id)) {
                ordered.push({ card, listId: list.id });
            }
        }
    }
    return ordered.sort(
        (a, b) => selectedCardIds.indexOf(a.card.id) - selectedCardIds.indexOf(b.card.id),
    );
}

export async function bulkDeleteCards(cards, boardId, collabDispatch, showConfirm) {
    if (!cards.length) return false;
    const confirmed = await showConfirm({
        title: cards.length === 1 ? 'Deletar Tarefa' : 'Deletar Tarefas',
        message: cards.length === 1
            ? `Tem certeza que deseja deletar "${cards[0].card.title}"?`
            : `Tem certeza que deseja deletar ${cards.length} tarefas selecionadas?`,
        confirmLabel: 'Deletar',
        type: 'danger',
    });
    if (!confirmed) return false;
    for (const { card, listId } of cards) {
        collabDispatch({
            type: 'DELETE_CARD',
            payload: { boardId, listId, cardId: card.id },
        });
    }
    return true;
}

export function bulkUpdateCards(cards, boardId, updates, collabDispatch) {
    for (const { card, listId } of cards) {
        collabDispatch({
            type: 'UPDATE_CARD',
            payload: { boardId, listId, cardId: card.id, updates },
        });
    }
}

export function bulkDuplicateCards(cards, boardId, collabDispatch) {
    for (const { card, listId } of cards) {
        collabDispatch(buildDuplicateCardPayload(card, listId, boardId));
    }
}

export function copyCardsToClipboard(cards, boardId, sourceListId, setClipboard) {
    if (!cards.length) return;
    setClipboard({
        mode: 'copy',
        boardId,
        sourceListId,
        cards: cards.map(({ card }) => serializeCardForClipboard(card)),
    });
}

export async function cutCardsToClipboard(cards, boardId, sourceListId, setClipboard, collabDispatch) {
    setClipboard({
        mode: 'cut',
        boardId,
        sourceListId,
        cards: cards.map(({ card }) => serializeCardForClipboard(card)),
    });
    for (const { card, listId } of cards) {
        collabDispatch({
            type: 'DELETE_CARD',
            payload: { boardId, listId, cardId: card.id },
        });
    }
}

export function pasteCardsFromClipboard(clipboard, targetListId, boardId, collabDispatch) {
    if (!clipboard?.cards?.length) return;
    for (const card of clipboard.cards) {
        collabDispatch(buildPasteCardPayload(card, targetListId, boardId));
    }
}

export function applyCompletionListUpdates(movedCard, destList, boardId, destListId, collabDispatch) {
    if (!destList?.isCompletionList || !movedCard) return;
    const allSubtasksDone = movedCard.subtasks?.every((st) => st.done);
    if (!movedCard.completed || !allSubtasksDone) {
        collabDispatch({
            type: 'UPDATE_CARD',
            payload: {
                boardId,
                listId: destListId,
                cardId: movedCard.id,
                updates: {
                    completed: true,
                    subtasks: (movedCard.subtasks || []).map((st) => ({ ...st, done: true })),
                },
            },
        });
    }
}

/**
 * Move cards to destList starting at dropIndex, preserving selection order.
 * primaryCardId lands at dropIndex; earlier items in the group go before it.
 */
export function bulkMoveCardsToIndex(cards, destListId, dropIndex, primaryCardId, getBoard, collabDispatch) {
    if (!destListId || !cards.length) return;

    const board = typeof getBoard === 'function' ? getBoard() : getBoard;
    if (!board?.lists?.length) return;

    const lists = board.lists.map((l) => ({ ...l, cards: [...l.cards] }));
    const destListInitial = lists.find((l) => l.id === destListId);
    if (!destListInitial) return;

    const primaryIdx = cards.findIndex(({ card }) => card.id === primaryCardId);
    const anchorIdx = primaryIdx >= 0 ? primaryIdx : 0;
    let insertAt = Math.max(0, dropIndex - anchorIdx);

    const moves = [];

    for (const { card, listId: sourceListId } of cards) {
        const sourceList = lists.find((l) => l.id === sourceListId);
        const destList = lists.find((l) => l.id === destListId);
        if (!sourceList || !destList) continue;

        const sourceIndex = sourceList.cards.findIndex((c) => c.id === card.id);
        if (sourceIndex < 0) continue;

        const destIndex = Math.min(insertAt, destList.cards.length);
        moves.push({ card, sourceListId, destListId, sourceIndex, destIndex });

        const [moved] = sourceList.cards.splice(sourceIndex, 1);
        destList.cards.splice(destIndex, 0, moved);
        insertAt += 1;
    }

    for (const { card, sourceListId, destListId: destId, sourceIndex, destIndex } of moves) {
        collabDispatch({
            type: 'MOVE_CARD',
            payload: {
                boardId: board.id,
                cardId: card.id,
                sourceListId,
                destListId: destId,
                sourceIndex,
                destIndex,
            },
        });
        const destList = board.lists.find((l) => l.id === destId);
        applyCompletionListUpdates(card, destList, board.id, destId, collabDispatch);
    }
}

export function bulkMoveCardsToList(cards, destListId, getBoard, collabDispatch) {
    if (!destListId) return;
    let destIndexOffset = 0;

    for (const { card, listId: sourceListId } of cards) {
        const board = typeof getBoard === 'function' ? getBoard() : getBoard;
        if (!board?.lists?.length) return;
        if (sourceListId === destListId) continue;

        const destList = board.lists.find((l) => l.id === destListId);
        const sourceList = board.lists.find((l) => l.id === sourceListId);
        if (!destList || !sourceList) continue;

        const sourceIndex = sourceList.cards.findIndex((c) => c.id === card.id);
        if (sourceIndex < 0) continue;

        const destIndex = destList.cards.length + destIndexOffset;

        collabDispatch({
            type: 'MOVE_CARD',
            payload: {
                boardId: board.id,
                cardId: card.id,
                sourceListId,
                destListId,
                sourceIndex,
                destIndex,
            },
        });
        applyCompletionListUpdates(card, destList, board.id, destListId, collabDispatch);
        destIndexOffset += 1;
    }
}

export function buildMoveToListMenuItems(lists, currentListId, onMove) {
    const moveLists = currentListId
        ? lists.filter((l) => l.id !== currentListId)
        : lists;
    return moveLists.map((l) => ({
        label: l.title,
        tint: l.color || null,
        action: () => onMove(l.id),
    }));
}
