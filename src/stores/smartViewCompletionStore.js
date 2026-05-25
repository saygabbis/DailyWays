import { create } from 'zustand';
import storageService from '../services/storageService.js';

export const RECENT_COMPLETION_LIMIT = 15;

function storageKey(userId) {
    return `dailyways_smart_recent_completions_v1_${userId}`;
}

export const useSmartViewCompletionStore = create((set, get) => ({
    userId: null,
    entries: [],
    lastHistoryBoardId: null,

    initForUser(userId) {
        if (!userId) {
            set({ userId: null, entries: [], lastHistoryBoardId: null });
            return;
        }
        const loaded = storageService.load(storageKey(userId));
        set({
            userId,
            entries: Array.isArray(loaded) ? loaded.slice(0, RECENT_COMPLETION_LIMIT) : [],
            lastHistoryBoardId: null,
        });
    },

    record(entry) {
        const { userId, entries } = get();
        if (!userId || !entry?.cardId || !entry?.boardId) return;

        const next = [
            {
                ...entry,
                sourceListId: entry.sourceListId ?? entry.listId,
                completedAt: entry.completedAt ?? Date.now(),
            },
            ...entries.filter(
                (e) => !(e.cardId === entry.cardId && e.boardId === entry.boardId),
            ),
        ].slice(0, RECENT_COMPLETION_LIMIT);

        set({ entries: next, lastHistoryBoardId: entry.boardId });
        storageService.save(storageKey(userId), next);
    },

    getEntry(cardId, boardId) {
        return get().entries.find(
            (e) => e.cardId === cardId && e.boardId === boardId,
        ) ?? null;
    },

    remove(cardId, boardId) {
        const { userId, entries } = get();
        if (!userId) return null;
        const removed = entries.find(
            (e) => e.cardId === cardId && e.boardId === boardId,
        );
        const next = entries.filter(
            (e) => !(e.cardId === cardId && e.boardId === boardId),
        );
        set({ entries: next });
        storageService.save(storageKey(userId), next);
        return removed ?? null;
    },

    setLastHistoryBoardId(boardId) {
        if (boardId) set({ lastHistoryBoardId: boardId });
    },
}));
