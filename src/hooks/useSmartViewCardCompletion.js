import { useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useBoardCollabContext } from '../collab/board/ops/BoardCollabContext.jsx';
import { dispatchToggleCardCompletion, findCardOnBoard } from '../utils/cardCompletion';
import { useSmartViewCompletionStore } from '../stores/smartViewCompletionStore';
import { ensureBoardHistoryHydrated } from '../collab/board/history/boardHistorySync.js';
import { useAuth } from '../context/AuthContext';

/** Concluir / desfazer conclusão nas smart views com persistência, collab e undo. */
export function useSmartViewCardCompletion() {
    const { state, flushBoardPersist } = useApp();
    const { user } = useAuth();
    const ctx = useBoardCollabContext();
    const recordCompletion = useSmartViewCompletionStore((s) => s.record);
    const removeCompletion = useSmartViewCompletionStore((s) => s.remove);
    const getCompletionEntry = useSmartViewCompletionStore((s) => s.getEntry);

    const getBoardSnapshot = useCallback((boardId) => {
        const b = state.boards.find((x) => x.id === boardId);
        return b ? JSON.parse(JSON.stringify(b)) : null;
    }, [state.boards]);

    const collabDispatchForBoard = useCallback(
        async (boardId, action, options) => {
            if (ctx?.collabDispatchForBoard) {
                await ctx.collabDispatchForBoard(boardId, action, options);
            }
        },
        [ctx],
    );

    const toggleCardCompletion = useCallback(async (card, boardMeta, listMeta, markComplete) => {
        const boardId = card.boardId || boardMeta?.id;
        if (!boardId) return;

        const liveBoard = state.boards.find((b) => b.id === boardId);
        if (!liveBoard) return;

        if (user?.id) {
            await ensureBoardHistoryHydrated(user.id, boardId);
        }

        const loc = findCardOnBoard(liveBoard, card.id);
        const sourceListId = loc?.list.id ?? card.listId ?? listMeta?.id;
        let restoreListId = sourceListId;

        if (!markComplete) {
            const entry = getCompletionEntry(card.id, boardId) ?? removeCompletion(card.id, boardId);
            restoreListId = entry?.sourceListId ?? sourceListId;
        }

        await dispatchToggleCardCompletion({
            board: liveBoard,
            cardId: card.id,
            markComplete,
            collabDispatchForBoard,
            getBoardSnapshot,
            restoreListId: markComplete ? null : restoreListId,
        });

        await flushBoardPersist(boardId);

        if (markComplete) {
            recordCompletion({
                cardId: card.id,
                boardId,
                listId: sourceListId,
                sourceListId,
                title: card.title,
                boardTitle: card.boardTitle || boardMeta?.title,
                boardEmoji: card.boardEmoji || boardMeta?.emoji,
                listTitle: card.listTitle || listMeta?.title,
            });
        }
    }, [
        state.boards,
        user?.id,
        collabDispatchForBoard,
        getBoardSnapshot,
        recordCompletion,
        removeCompletion,
        getCompletionEntry,
        flushBoardPersist,
    ]);

    return { toggleCardCompletion, getBoardSnapshot };
}
