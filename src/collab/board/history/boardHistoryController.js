import { applyBoardAction } from '@dailyways/collab-protocol';
import { shouldRecordBoardAction } from './boardHistoryPolicy.js';
import {
    canCoalesceWithLastEntry,
    mergeCoalescedForward,
} from './boardHistoryCoalesce.js';
import {
    buildInverseAction,
    buildBatchInverse,
    flattenHistoryActions,
} from './boardHistoryInvert.js';
import { createHistoryEntry, useBoardHistoryStore } from './boardHistoryStore.js';

let applyingHistory = false;
let flushTextHistoryForBoardFn = null;

export function registerTextHistoryFlush(fn) {
    flushTextHistoryForBoardFn = fn;
}

let batchDepth = 0;
let batchBoardId = null;
let batchStartBoard = null;
let batchForwards = [];

export function isApplyingBoardHistory() {
    return applyingHistory;
}

export function beginBoardHistoryBatch(boardId, getBoardSnapshot) {
    if (batchDepth === 0) {
        batchBoardId = boardId;
        batchStartBoard = getBoardSnapshot(boardId);
        batchForwards = [];
    }
    batchDepth += 1;
}

export function endBoardHistoryBatch() {
    if (batchDepth <= 0) return;
    batchDepth -= 1;
    if (batchDepth > 0) return;

    const boardId = batchBoardId;
    const startBoard = batchStartBoard;
    const forwards = batchForwards.slice();
    batchBoardId = null;
    batchStartBoard = null;
    batchForwards = [];

    if (!boardId || !startBoard || !forwards.length) return;

    const inverse = buildBatchInverse(startBoard, forwards);
    if (!inverse) return;

    const forward = forwards.length === 1
        ? forwards[0]
        : { type: 'BATCH', payload: { boardId, actions: forwards } };

    useBoardHistoryStore.getState().pushEntry(
        boardId,
        createHistoryEntry(boardId, forward, inverse),
    );
}

export function runWithBoardHistoryBatch(boardId, getBoardSnapshot, fn) {
    beginBoardHistoryBatch(boardId, getBoardSnapshot);
    try {
        fn();
    } finally {
        endBoardHistoryBatch();
    }
}

function tryCoalesceHistoryEntry(boardId, forward) {
    const store = useBoardHistoryStore.getState();
    const { entries, index } = store.getStack(boardId);
    if (index < 0 || !entries[index]) return false;

    const last = entries[index];
    if (!canCoalesceWithLastEntry(last, forward)) return false;

    const mergedForward = mergeCoalescedForward(last, forward);
    store.replaceLastEntry(
        boardId,
        {
            ...last,
            forward: JSON.parse(JSON.stringify(mergedForward)),
            ts: Date.now(),
        },
    );
    return true;
}

export function commitPendingTextHistory(boardId, pending) {
    if (!pending?.boardBefore || !pending?.forward) return;
    recordBoardHistory(boardId, pending.boardBefore, pending.forward);
}

export function flushAllPendingTextHistory(pendingMap, boardId = null) {
    for (const [key, pending] of [...pendingMap.entries()]) {
        if (boardId && pending.boardId !== boardId) continue;
        commitPendingTextHistory(pending.boardId, pending);
        pendingMap.delete(key);
    }
}

export function recordBoardHistory(boardId, boardBefore, forward) {
    if (applyingHistory || batchDepth > 0) {
        if (batchDepth > 0 && shouldRecordBoardAction(forward)) {
            batchForwards.push(JSON.parse(JSON.stringify(forward)));
        }
        return;
    }
    if (!shouldRecordBoardAction(forward) || !boardBefore) return;

    if (tryCoalesceHistoryEntry(boardId, forward)) return;

    const inverse = buildInverseAction(boardBefore, forward);
    if (!inverse) return;

    useBoardHistoryStore.getState().pushEntry(
        boardId,
        createHistoryEntry(boardId, forward, inverse),
    );
}

async function applyHistoryActions(collabDispatchForBoard, boardId, action) {
    const actions = flattenHistoryActions(action);
    for (const a of actions) {
        await collabDispatchForBoard(boardId, a, { skipHistory: true, awaitCollab: true });
    }
}

export async function performBoardUndo(boardId, getBoardSnapshot, collabDispatchForBoard, userId) {
    flushTextHistoryForBoardFn?.(boardId);
    if (userId) {
        const { ensureBoardHistoryHydrated } = await import('./boardHistorySync.js');
        await ensureBoardHistoryHydrated(userId, boardId);
    }
    const store = useBoardHistoryStore.getState();
    if (!store.canUndo(boardId)) return false;

    const { entry, nextIndex } = store.getEntry(boardId, 'undo');
    if (!entry?.inverse) return false;

    applyingHistory = true;
    try {
        await applyHistoryActions(collabDispatchForBoard, boardId, entry.inverse);
        store.setIndex(boardId, nextIndex);
    } finally {
        applyingHistory = false;
    }
    return true;
}

export async function performBoardRedo(boardId, getBoardSnapshot, collabDispatchForBoard, userId) {
    if (userId) {
        const { ensureBoardHistoryHydrated } = await import('./boardHistorySync.js');
        await ensureBoardHistoryHydrated(userId, boardId);
    }
    const store = useBoardHistoryStore.getState();
    if (!store.canRedo(boardId)) return false;

    const { entry, nextIndex } = store.getEntry(boardId, 'redo');
    if (!entry?.forward) return false;

    applyingHistory = true;
    try {
        await applyHistoryActions(collabDispatchForBoard, boardId, entry.forward);
        store.setIndex(boardId, nextIndex);
    } finally {
        applyingHistory = false;
    }
    return true;
}

/** Valida se o redo/undo ainda é aplicável (evita erro grosseiro se o board mudou muito). */
export function previewApply(board, action) {
    try {
        return applyBoardAction(board, action);
    } catch {
        return board;
    }
}
