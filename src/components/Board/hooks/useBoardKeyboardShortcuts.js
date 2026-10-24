/** Atalhos do board (copiar/recortar/colar/duplicar/apagar cards selecionados, desfazer/refazer). */
import { useEffect } from 'react';
import { useBoardSelectionStore } from '../../../stores/boardSelectionStore';
import {
    copyCardsToClipboard,
    cutCardsToClipboard,
    pasteCardsFromClipboard,
    bulkDeleteCards,
    bulkDuplicateCards,
    resolveSelectedCards,
} from '../boardCardBulkOps';

export function useBoardKeyboardShortcuts(ctx) {
    const {
        focusedCardId,
        getActiveBoard,
        showConfirm,
        collabDispatch,
        getBoardSnapshot,
        selectedCardIds,
        clearSelection,
        clipboard,
        setClipboard,
        anchorListId,
    } = ctx;

    useEffect(() => {
        const isEditableTarget = () => {
            const el = document.activeElement;
            if (!el) return false;
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable) {
                return true;
            }
            return false;
        };

        const shouldHandleShortcut = () => {
            if (focusedCardId) return false;
            if (isEditableTarget()) return false;
            return Boolean(getActiveBoard()?.id);
        };

        const onKeyDown = async (e) => {
            const activeBoard = getActiveBoard();
            if (!shouldHandleShortcut() || !activeBoard) return;
            const mod = e.ctrlKey || e.metaKey;
            const key = e.key.toLowerCase();

            if (e.key === 'Escape') {
                if (selectedCardIds.length) {
                    e.preventDefault();
                    clearSelection();
                }
                return;
            }

            if (!selectedCardIds.length && !mod) return;

            if (mod && key === 'd' && !e.shiftKey) {
                e.preventDefault();
                const cards = resolveSelectedCards(activeBoard, selectedCardIds);
                if (cards.length) {
                    bulkDuplicateCards(cards, activeBoard.id, collabDispatch);
                }
                return;
            }

            if (mod && key === 'c' && !e.shiftKey) {
                e.preventDefault();
                const cards = resolveSelectedCards(activeBoard, selectedCardIds);
                copyCardsToClipboard(cards, activeBoard.id, anchorListId, setClipboard);
                return;
            }
            if (mod && key === 'x' && !e.shiftKey) {
                e.preventDefault();
                const cards = resolveSelectedCards(activeBoard, selectedCardIds);
                await cutCardsToClipboard(cards, activeBoard.id, anchorListId, setClipboard, collabDispatch, getBoardSnapshot);
                clearSelection();
                return;
            }
            if (mod && key === 'v' && !e.shiftKey) {
                e.preventDefault();
                if (!clipboard?.cards?.length) return;
                const targetListId = anchorListId || activeBoard.lists[0]?.id;
                if (!targetListId) return;
                pasteCardsFromClipboard(clipboard, targetListId, activeBoard.id, collabDispatch);
                if (clipboard.mode === 'cut') {
                    useBoardSelectionStore.getState().clearClipboard();
                }
                return;
            }
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedCardIds.length) {
                e.preventDefault();
                const cards = resolveSelectedCards(activeBoard, selectedCardIds);
                const ok = await bulkDeleteCards(
                    cards,
                    activeBoard.id,
                    collabDispatch,
                    showConfirm,
                    getBoardSnapshot,
                    { defaultPermanentChecked: e.shiftKey },
                );
                if (ok) clearSelection();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [
        getActiveBoard,
        selectedCardIds,
        focusedCardId,
        clipboard,
        anchorListId,
        clearSelection,
        setClipboard,
        collabDispatch,
        showConfirm,
        getBoardSnapshot,
    ]);

}
