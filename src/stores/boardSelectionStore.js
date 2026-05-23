import { create } from 'zustand';

export const useBoardSelectionStore = create((set, get) => ({
    boardId: null,
    selectedCardIds: [],
    anchorListId: null,
    anchorCardId: null,
    clipboard: null,
    shiftSelecting: false,
    longPressPendingCardId: null,
    multiDragCardIds: [],

    setBoard: (boardId) => {
        const prev = get().boardId;
        if (prev === boardId) return;
        set({
            boardId,
            selectedCardIds: [],
            anchorListId: null,
            anchorCardId: null,
            longPressPendingCardId: null,
            multiDragCardIds: [],
        });
    },

    clearSelection: () => set({
        selectedCardIds: [],
        anchorListId: null,
        anchorCardId: null,
    }),

    toggleCard: (cardId, listId) => {
        const { selectedCardIds } = get();
        const isSelected = selectedCardIds.includes(cardId);
        const next = isSelected
            ? selectedCardIds.filter((id) => id !== cardId)
            : [...selectedCardIds, cardId];
        set({
            selectedCardIds: next,
            anchorListId: listId,
            anchorCardId: cardId,
        });
    },

    selectOnly: (cardId, listId) => set({
        selectedCardIds: [cardId],
        anchorListId: listId,
        anchorCardId: cardId,
    }),

    selectMany: (cardIds, listId = null) => {
        const { selectedCardIds } = get();
        const merged = [...new Set([...selectedCardIds, ...cardIds])];
        set({
            selectedCardIds: merged,
            anchorListId: listId ?? get().anchorListId,
            anchorCardId: cardIds[cardIds.length - 1] ?? get().anchorCardId,
        });
    },

    selectRange: (listId, visibleCardIds, fromId, toId) => {
        const fromIdx = visibleCardIds.indexOf(fromId);
        const toIdx = visibleCardIds.indexOf(toId);
        if (fromIdx < 0 || toIdx < 0) {
            get().addCardToSelection(toId, listId);
            return;
        }
        const start = Math.min(fromIdx, toIdx);
        const end = Math.max(fromIdx, toIdx);
        const rangeIds = visibleCardIds.slice(start, end + 1);
        const { selectedCardIds } = get();
        const merged = [...new Set([...selectedCardIds, ...rangeIds])];
        set({
            selectedCardIds: merged,
            anchorListId: listId,
            anchorCardId: toId,
        });
    },

    /** Adiciona um card à seleção sem limpar os demais (Shift/Ctrl noutra coluna). */
    addCardToSelection: (cardId, listId) => {
        const { selectedCardIds } = get();
        const next = selectedCardIds.includes(cardId)
            ? selectedCardIds
            : [...selectedCardIds, cardId];
        set({
            selectedCardIds: next,
            anchorListId: listId,
            anchorCardId: cardId,
        });
    },

    /**
     * Shift+click: intervalo na mesma coluna (último selecionado → clicado);
     * noutra coluna, acrescenta sem limpar a seleção existente.
     */
    selectRangeInList: (listId, visibleCardIds, toCardId) => {
        if (!visibleCardIds?.length || !toCardId) return;

        const { selectedCardIds, anchorListId, anchorCardId } = get();
        let fromId = null;

        if (anchorListId === listId && anchorCardId && visibleCardIds.includes(anchorCardId)) {
            fromId = anchorCardId;
        } else {
            for (let i = visibleCardIds.length - 1; i >= 0; i -= 1) {
                if (selectedCardIds.includes(visibleCardIds[i])) {
                    fromId = visibleCardIds[i];
                    break;
                }
            }
        }

        if (!fromId) {
            get().addCardToSelection(toCardId, listId);
            return;
        }

        if (fromId === toCardId) {
            set({ anchorListId: listId, anchorCardId: toCardId });
            return;
        }

        get().selectRange(listId, visibleCardIds, fromId, toCardId);
    },

    setShiftSelecting: (shiftSelecting) => set({ shiftSelecting }),

    setLongPressPending: (cardId) => set({ longPressPendingCardId: cardId ?? null }),

    setClipboard: (clipboard) => set({ clipboard }),

    clearClipboard: () => set({ clipboard: null }),

    beginMultiDrag: (draggableCardId) => {
        const { selectedCardIds } = get();
        const multiDragCardIds = (
            selectedCardIds.includes(draggableCardId) && selectedCardIds.length > 1
        )
            ? [...selectedCardIds]
            : [draggableCardId];
        set({ multiDragCardIds });
    },

    clearMultiDrag: () => set({ multiDragCardIds: [] }),
}));
