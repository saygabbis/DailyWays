import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useBoardCollabContext } from '../collab/board/ops/BoardCollabContext.jsx';
import { useBoardHistoryStore } from '../collab/board/history/boardHistoryStore.js';
import { performBoardUndo, performBoardRedo } from '../collab/board/history/boardHistoryController.js';

export function useBoardUndo(boardId) {
    const { user } = useAuth();
    const { state, persistBoard } = useApp();
    const ctx = useBoardCollabContext();

    const getBoardSnapshot = useCallback((id) => {
        const b = state.boards.find((x) => x.id === id);
        return b ? JSON.parse(JSON.stringify(b)) : null;
    }, [state.boards]);

    const collabDispatchForBoard = useCallback(
        async (id, action, options) => {
            if (!ctx?.collabDispatchForBoard) return;
            await ctx.collabDispatchForBoard(id, action, options);
        },
        [ctx],
    );

    const canUndo = useBoardHistoryStore((s) => (boardId ? s.canUndo(boardId) : false));
    const canRedo = useBoardHistoryStore((s) => (boardId ? s.canRedo(boardId) : false));

    const flushAfterHistory = useCallback(async (ok) => {
        if (ok && boardId) {
            persistBoard(boardId, { force: true, ensureSave: true });
        }
        return ok;
    }, [boardId, persistBoard]);

    const undo = useCallback(async () => {
        if (!boardId || !user?.id) return false;
        const ok = await performBoardUndo(boardId, getBoardSnapshot, collabDispatchForBoard, user.id);
        return flushAfterHistory(ok);
    }, [boardId, user?.id, getBoardSnapshot, collabDispatchForBoard, flushAfterHistory]);

    const redo = useCallback(async () => {
        if (!boardId || !user?.id) return false;
        const ok = await performBoardRedo(boardId, getBoardSnapshot, collabDispatchForBoard, user.id);
        return flushAfterHistory(ok);
    }, [boardId, user?.id, getBoardSnapshot, collabDispatchForBoard, flushAfterHistory]);

    return { undo, redo, canUndo, canRedo };
}
