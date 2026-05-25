
export function getFirstCompletionList(board) {
    return board?.lists?.find((l) => l.isCompletionList) ?? null;
}

export function getFirstActiveList(board) {
    return board?.lists?.find((l) => !l.isCompletionList) ?? board?.lists?.[0] ?? null;
}

export function findCardOnBoard(board, cardId) {
    if (!board?.lists || !cardId) return null;
    for (const list of board.lists) {
        const sourceIndex = list.cards.findIndex((c) => c.id === cardId);
        if (sourceIndex >= 0) {
            return { list, card: list.cards[sourceIndex], sourceIndex };
        }
    }
    return null;
}

async function dispatchMarkCardComplete(collabDispatch, board, listId, card) {
    const allSubtasksDone = card.subtasks?.every((st) => st.done);
    if (card.completed && allSubtasksDone) return;

    await collabDispatch({
        type: 'UPDATE_CARD',
        payload: {
            boardId: board.id,
            listId,
            cardId: card.id,
            updates: {
                completed: true,
                subtasks: (card.subtasks || []).map((st) => ({ ...st, done: true })),
            },
        },
    });
}

/**
 * Marca/desmarca conclusão no board (collab + undo). Move para a primeira lista de conclusão se existir.
 */
function resolveRestoreList(board, restoreListId) {
    if (restoreListId) {
        const found = board.lists?.find((l) => l.id === restoreListId && !l.isCompletionList);
        if (found) return found;
    }
    return getFirstActiveList(board);
}

export async function dispatchToggleCardCompletion({
    board,
    cardId,
    markComplete,
    collabDispatch,
    collabDispatchForBoard,
    getBoardSnapshot,
    restoreListId = null,
}) {
    const emit = collabDispatchForBoard
        ? (action) => collabDispatchForBoard(board.id, action, { deferPersist: true })
        : (action) => Promise.resolve(collabDispatch(action));

    if (!board?.id || !cardId || (!collabDispatch && !collabDispatchForBoard)) return false;

    const loc = findCardOnBoard(board, cardId);
    if (!loc) return false;

    const { list, card, sourceIndex } = loc;

    const run = async () => {
        if (!markComplete) {
            const targetList = list.isCompletionList
                ? resolveRestoreList(board, restoreListId)
                : null;

            if (targetList && targetList.id !== list.id) {
                await emit({
                    type: 'MOVE_CARD',
                    payload: {
                        boardId: board.id,
                        cardId: card.id,
                        sourceListId: list.id,
                        destListId: targetList.id,
                        sourceIndex,
                        destIndex: targetList.cards.length,
                    },
                });
                await emit({
                    type: 'UPDATE_CARD',
                    payload: {
                        boardId: board.id,
                        listId: targetList.id,
                        cardId: card.id,
                        updates: {
                            completed: false,
                            subtasks: (card.subtasks || []).map((st) => ({ ...st, done: false })),
                        },
                    },
                });
                return;
            }

            await emit({
                type: 'UPDATE_CARD',
                payload: {
                    boardId: board.id,
                    listId: list.id,
                    cardId: card.id,
                    updates: {
                        completed: false,
                        subtasks: (card.subtasks || []).map((st) => ({ ...st, done: false })),
                    },
                },
            });
            return;
        }

        if (card.completed && list.isCompletionList) return;

        const completionList = getFirstCompletionList(board);

        if (completionList && !list.isCompletionList) {
            const destIndex = completionList.cards.length;
            await emit({
                type: 'MOVE_CARD',
                payload: {
                    boardId: board.id,
                    cardId: card.id,
                    sourceListId: list.id,
                    destListId: completionList.id,
                    sourceIndex,
                    destIndex,
                },
            });
            await dispatchMarkCardComplete(emit, board, completionList.id, card);
        } else if (list.isCompletionList) {
            await dispatchMarkCardComplete(emit, board, list.id, card);
        } else {
            await dispatchMarkCardComplete(emit, board, list.id, card);
        }
    };

    await run();
    return true;
}

/** @deprecated use cardCompletion.js — mantido para BoardView drag */
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
