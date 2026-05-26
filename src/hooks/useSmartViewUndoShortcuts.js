import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBoardUndo } from './useBoardUndo';
import { useSmartViewCompletionStore } from '../stores/smartViewCompletionStore.js';
import { ensureBoardHistoryHydrated } from '../collab/board/history/boardHistorySync.js';

function isEditableTarget() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();
    return tag === 'input' || tag === 'textarea' || el.isContentEditable;
}

/** Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y nas smart views (último board alterado). */
export function useSmartViewUndoShortcuts(fallbackBoardId) {
    const { user } = useAuth();
    const lastHistoryBoardId = useSmartViewCompletionStore((s) => s.lastHistoryBoardId);
    const boardId = lastHistoryBoardId || fallbackBoardId || null;
    const { undo, redo } = useBoardUndo(boardId);

    useEffect(() => {
        const onKeyDown = async (e) => {
            if (!boardId || !user?.id || isEditableTarget()) return;
            const mod = e.ctrlKey || e.metaKey;
            if (!mod) return;
            const key = e.key?.toLowerCase?.() || e.key;

            if (key === 'z' && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                await ensureBoardHistoryHydrated(user.id, boardId);
                await undo();
                return;
            }
            if (key === 'y' || (key === 'z' && e.shiftKey)) {
                e.preventDefault();
                e.stopPropagation();
                await ensureBoardHistoryHydrated(user.id, boardId);
                await redo();
            }
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [boardId, user?.id, undo, redo]);
}
