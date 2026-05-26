import { fetchBoardUndoStack, upsertBoardUndoStack } from '../../../services/boardService.js';
import storageService from '../../../services/storageService.js';
import { BOARD_HISTORY_MAX, mergeHistoryStacks } from './boardHistoryStore.js';

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

function pickRicherStack(a, b) {
    return mergeHistoryStacks(a, b);
}

const hydratedBoardIds = new Set();

export function resetBoardHistoryHydrationCache() {
    hydratedBoardIds.clear();
}

/** Carrega pilha undo uma vez por board/sessão (evita apagar histórico ao trocar de vista). */
export async function ensureBoardHistoryHydrated(userId, boardId) {
    if (!userId || !boardId || hydratedBoardIds.has(boardId)) return;
    const { useBoardHistoryStore } = await import('./boardHistoryStore.js');
    const store = useBoardHistoryStore.getState();
    const inMemory = store.getStack(boardId);
    const stack = await hydrateBoardHistory(userId, boardId);
    const merged = mergeHistoryStacks(inMemory, stack || { entries: [], index: -1 });
    store.hydrateBoard(boardId, merged);
    hydratedBoardIds.add(boardId);
}

/** Carrega histórico remoto e funde com local para um board. */
export async function hydrateBoardHistory(userId, boardId) {
    if (!userId || !boardId) return null;

    const allLocal = storageService.load(storageKey(userId)) || {};
    const localStack = allLocal[boardId];

    const { data: remoteStack } = await fetchBoardUndoStack(boardId);
    const merged = pickRicherStack(localStack, remoteStack);
    if (!merged.entries.length && merged.index < 0) return merged;

    allLocal[boardId] = merged;
    storageService.save(storageKey(userId), allLocal);
    return merged;
}

let remotePersistTimer = null;
let pendingRemoteBoardId = null;
let pendingRemoteStack = null;
let pendingRemoteUserId = null;

export function scheduleRemoteBoardHistoryPersist(userId, boardId, stack) {
    if (!userId || !boardId) return;
    pendingRemoteUserId = userId;
    pendingRemoteBoardId = boardId;
    pendingRemoteStack = stack;
    if (remotePersistTimer) clearTimeout(remotePersistTimer);
    remotePersistTimer = setTimeout(async () => {
        const uid = pendingRemoteUserId;
        const bid = pendingRemoteBoardId;
        const st = pendingRemoteStack;
        remotePersistTimer = null;
        if (!uid || !bid || !st) return;
        await upsertBoardUndoStack(bid, st);
    }, 1200);
}
