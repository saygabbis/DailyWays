import { create } from 'zustand';
import storageService from '../../../services/storageService';
import { uuidv4 } from '../../../utils/uuid';
import { scheduleRemoteBoardHistoryPersist, resetBoardHistoryHydrationCache } from './boardHistorySync.js';

export const BOARD_HISTORY_MAX = 1000;

function storageKey(userId) {
    return `dailyways_board_history_v1_${userId}`;
}

function normalizeStack(raw) {
    if (!raw || typeof raw !== 'object') return { entries: [], index: -1 };
    const entries = Array.isArray(raw.entries) ? raw.entries.slice(-BOARD_HISTORY_MAX) : [];
    let index = Number.isInteger(raw.index) ? raw.index : entries.length - 1;
    index = Math.max(-1, Math.min(index, entries.length - 1));
    return { entries, index };
}

/** Mantém a pilha com mais histórico utilizável (não sobrescreve undo local). */
export function mergeHistoryStacks(a, b) {
    const na = normalizeStack(a);
    const nb = normalizeStack(b);
    if (nb.index > na.index) return nb;
    if (na.index > nb.index) return na;
    if (nb.entries.length > na.entries.length) return nb;
    if (na.entries.length > nb.entries.length) return na;
    return nb;
}

let persistTimer = null;

function schedulePersist(userId, stacks) {
    if (!userId) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
        storageService.save(storageKey(userId), stacks);
        persistTimer = null;
    }, 280);
}

export const useBoardHistoryStore = create((set, get) => ({
    userId: null,
    stacks: {},

    initForUser(userId) {
        resetBoardHistoryHydrationCache();
        if (!userId) {
            set({ userId: null, stacks: {} });
            return;
        }
        const loaded = storageService.load(storageKey(userId));
        set({
            userId,
            stacks: loaded && typeof loaded === 'object' ? loaded : {},
        });
    },

    getStack(boardId) {
        const stack = get().stacks[boardId];
        return stack || { entries: [], index: -1 };
    },

    pushEntry(boardId, entry) {
        const { userId, stacks } = get();
        if (!userId || !boardId || !entry) return;

        const prev = stacks[boardId] || { entries: [], index: -1 };
        const entries = prev.entries.slice(0, prev.index + 1);
        entries.push(entry);
        while (entries.length > BOARD_HISTORY_MAX) {
            entries.shift();
        }
        const nextStacks = {
            ...stacks,
            [boardId]: { entries, index: entries.length - 1 },
        };
        set({ stacks: nextStacks });
        schedulePersist(userId, nextStacks);
        scheduleRemoteBoardHistoryPersist(userId, boardId, nextStacks[boardId]);
    },

    replaceLastEntry(boardId, entry) {
        const { userId, stacks } = get();
        if (!userId || !boardId || !entry) return;
        const prev = stacks[boardId];
        if (!prev || prev.index < 0) return;

        const entries = [...prev.entries];
        entries[prev.index] = entry;
        const nextStacks = {
            ...stacks,
            [boardId]: { entries, index: prev.index },
        };
        set({ stacks: nextStacks });
        schedulePersist(userId, nextStacks);
        scheduleRemoteBoardHistoryPersist(userId, boardId, nextStacks[boardId]);
    },

    hydrateBoard(boardId, stack) {
        const { userId, stacks } = get();
        if (!userId || !boardId || !stack) return;
        const merged = mergeHistoryStacks(stacks[boardId], stack);
        const nextStacks = { ...stacks, [boardId]: merged };
        set({ stacks: nextStacks });
    },

    setIndex(boardId, nextIndex) {
        const { userId, stacks } = get();
        if (!userId || !boardId) return;
        const prev = stacks[boardId];
        if (!prev) return;
        const index = Math.max(-1, Math.min(nextIndex, prev.entries.length - 1));
        const nextStacks = {
            ...stacks,
            [boardId]: { ...prev, index },
        };
        set({ stacks: nextStacks });
        schedulePersist(userId, nextStacks);
        scheduleRemoteBoardHistoryPersist(userId, boardId, nextStacks[boardId]);
    },

    clearBoard(boardId) {
        const { userId, stacks } = get();
        if (!userId || !boardId) return;
        const nextStacks = { ...stacks };
        delete nextStacks[boardId];
        set({ stacks: nextStacks });
        schedulePersist(userId, nextStacks);
    },

    canUndo(boardId) {
        const { index } = get().getStack(boardId);
        return index >= 0;
    },

    canRedo(boardId) {
        const { entries, index } = get().getStack(boardId);
        return index < entries.length - 1;
    },

    getEntry(boardId, direction) {
        const { entries, index } = get().getStack(boardId);
        if (direction === 'undo') {
            if (index < 0) return null;
            return { entry: entries[index], nextIndex: index - 1 };
        }
        if (index >= entries.length - 1) return null;
        return { entry: entries[index + 1], nextIndex: index + 1 };
    },
}));

export function createHistoryEntry(boardId, forward, inverse) {
    return {
        id: uuidv4(),
        boardId,
        forward: JSON.parse(JSON.stringify(forward)),
        inverse: JSON.parse(JSON.stringify(inverse)),
        ts: Date.now(),
    };
}
