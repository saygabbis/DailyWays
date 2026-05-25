import { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useBoardUndo } from './useBoardUndo';

function isEditableTarget() {
    const el = document.activeElement;
    if (!el) return false;
    if (el.closest('.task-detail-modal')) return true;
    if (el.closest('.board-list') && el.tagName?.toLowerCase() === 'input') return false;
    const tag = el.tagName?.toLowerCase();
    return tag === 'input' || tag === 'textarea' || el.isContentEditable;
}

/**
 * Undo/redo global: pilha do board selecionado na sidebar (state.activeBoard),
 * em qualquer vista (Board, Importante, Planejado, etc.).
 */
export function useGlobalBoardUndoShortcuts({ enabled = true } = {}) {
    const { state } = useApp();
    const { user } = useAuth();
    const boardId = enabled ? (state.activeBoard || null) : null;
    const { undo, redo, canUndo, canRedo } = useBoardUndo(boardId);

    useEffect(() => {
        const onKeyDown = async (e) => {
            if (!boardId || !user?.id || isEditableTarget()) return;
            const mod = e.ctrlKey || e.metaKey;
            if (!mod) return;
            const key = e.key?.toLowerCase?.() || e.key;

            if (key === 'z' && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                await undo();
                return;
            }
            if (key === 'y' || (key === 'z' && e.shiftKey)) {
                e.preventDefault();
                e.stopPropagation();
                await redo();
            }
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [boardId, user?.id, undo, redo]);

    return { boardId, canUndo, canRedo, undo, redo };
}
