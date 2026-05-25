import { applyBoardAction } from '@dailyways/collab-protocol';

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}

export function findCardOnBoard(board, cardId) {
    if (!board?.lists || !cardId) return null;
    for (const list of board.lists) {
        const card = list.cards.find((c) => c.id === cardId);
        if (card) return { list, card, listId: list.id };
    }
    return null;
}

function findListOnBoard(board, listId) {
    if (!board?.lists || !listId) return null;
    const index = board.lists.findIndex((l) => l.id === listId);
    if (index < 0) return null;
    return { list: board.lists[index], index };
}

/** Uma ação inversa (ou null se não for reversível neste estado). */
export function buildInverseAction(board, forward) {
    if (!board || !forward?.type) return null;

    const p = forward.payload || {};
    const boardId = p.boardId || board.id;

    switch (forward.type) {
        case 'ADD_CARD':
            return {
                type: 'DELETE_CARD',
                payload: {
                    boardId,
                    listId: p.listId,
                    cardId: p.cardData?.id || p.cardId,
                },
            };

        case 'DELETE_CARD': {
            const found = findCardOnBoard(board, p.cardId);
            if (!found) return null;
            return {
                type: 'ADD_CARD',
                payload: {
                    boardId,
                    listId: p.listId || found.listId,
                    cardData: cloneJson(found.card),
                },
            };
        }

        case 'MOVE_CARD':
            return {
                type: 'MOVE_CARD',
                payload: {
                    boardId,
                    cardId: p.cardId,
                    sourceListId: p.destListId,
                    destListId: p.sourceListId,
                    sourceIndex: p.destIndex,
                    destIndex: p.sourceIndex,
                },
            };

        case 'UPDATE_CARD': {
            const found = findCardOnBoard(board, p.cardId);
            if (!found) return null;
            const updates = p.updates || {};
            const prev = {};
            for (const key of Object.keys(updates)) {
                if (key in found.card) prev[key] = cloneJson(found.card[key]);
            }
            if (!Object.keys(prev).length) return null;
            return {
                type: 'UPDATE_CARD',
                payload: {
                    boardId,
                    listId: p.listId || found.listId,
                    cardId: p.cardId,
                    updates: prev,
                },
            };
        }

        case 'ADD_LIST':
            return {
                type: 'DELETE_LIST',
                payload: {
                    boardId,
                    listId: p.id,
                },
            };

        case 'DELETE_LIST': {
            const found = findListOnBoard(board, p.listId);
            if (!found) return null;
            const list = cloneJson(found.list);
            const actions = [
                {
                    type: 'ADD_LIST',
                    payload: {
                        boardId,
                        id: list.id,
                        title: list.title,
                        color: list.color,
                        isCompletionList: list.isCompletionList,
                    },
                },
            ];
            if (found.index < board.lists.length - 1) {
                actions.push({
                    type: 'MOVE_LIST',
                    payload: {
                        boardId,
                        listId: list.id,
                        movingListId: list.id,
                        sourceIndex: board.lists.length,
                        destIndex: found.index,
                    },
                });
            }
            for (const card of list.cards || []) {
                actions.push({
                    type: 'ADD_CARD',
                    payload: {
                        boardId,
                        listId: list.id,
                        cardData: cloneJson(card),
                    },
                });
            }
            return wrapBatch(boardId, actions);
        }

        case 'MOVE_LIST':
            return {
                type: 'MOVE_LIST',
                payload: {
                    boardId,
                    listId: p.listId || p.movingListId,
                    movingListId: p.movingListId || p.listId,
                    sourceIndex: p.destIndex,
                    destIndex: p.sourceIndex,
                },
            };

        case 'UPDATE_LIST': {
            const found = findListOnBoard(board, p.listId);
            if (!found) return null;
            const updates = p.updates || {};
            const prev = {};
            for (const key of Object.keys(updates)) {
                if (key in found.list) prev[key] = cloneJson(found.list[key]);
            }
            if (!Object.keys(prev).length) return null;
            return {
                type: 'UPDATE_LIST',
                payload: { boardId, listId: p.listId, updates: prev },
            };
        }

        case 'TOGGLE_SUBTASK':
            return forward;

        case 'ADD_SUBTASK':
            return {
                type: 'DELETE_SUBTASK',
                payload: {
                    boardId,
                    listId: p.listId,
                    cardId: p.cardId,
                    subtaskId: p.subtaskId,
                },
            };

        case 'DELETE_SUBTASK': {
            const found = findCardOnBoard(board, p.cardId);
            if (!found) return null;
            const sub = (found.card.subtasks || []).find((st) => st.id === p.subtaskId);
            if (!sub) return null;
            return {
                type: 'ADD_SUBTASK',
                payload: {
                    boardId,
                    listId: p.listId,
                    cardId: p.cardId,
                    subtaskId: sub.id,
                    title: sub.title,
                },
            };
        }

        case 'UPDATE_SUBTASK': {
            const found = findCardOnBoard(board, p.cardId);
            if (!found) return null;
            const sub = (found.card.subtasks || []).find((st) => st.id === p.subtaskId);
            if (!sub) return null;
            const updates = p.updates || {};
            const prev = {};
            for (const key of Object.keys(updates)) {
                if (key in sub) prev[key] = cloneJson(sub[key]);
            }
            if (!Object.keys(prev).length) return null;
            return {
                type: 'UPDATE_SUBTASK',
                payload: {
                    boardId,
                    listId: p.listId,
                    cardId: p.cardId,
                    subtaskId: p.subtaskId,
                    updates: prev,
                },
            };
        }

        default:
            return null;
    }
}

export function wrapBatch(boardId, actions) {
    const filtered = actions.filter(Boolean);
    if (!filtered.length) return null;
    if (filtered.length === 1) return filtered[0];
    return {
        type: 'BATCH',
        payload: { boardId, actions: filtered },
    };
}

/** Inversos de um lote (estado = antes do lote). */
export function buildBatchInverse(startBoard, forwards) {
    if (!startBoard || !forwards?.length) return null;
    const boardId = forwards[0]?.payload?.boardId || startBoard.id;
    let simulated = cloneJson(startBoard);
    const inverses = [];

    for (let i = forwards.length - 1; i >= 0; i -= 1) {
        const inv = buildInverseAction(simulated, forwards[i]);
        if (inv) {
            if (inv.type === 'BATCH') {
                inverses.unshift(...inv.payload.actions);
            } else {
                inverses.unshift(inv);
            }
        }
        simulated = applyBoardAction(simulated, forwards[i]);
    }

    return wrapBatch(boardId, inverses);
}

export function flattenHistoryActions(action) {
    if (!action) return [];
    if (action.type === 'BATCH') return action.payload?.actions || [];
    return [action];
}
