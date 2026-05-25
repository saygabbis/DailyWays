/** Agrupa undo de texto (título/descrição) — um passo por palavra/frase, não por letra. */

export const HISTORY_COALESCE_MS = 2500;

const TEXT_CARD_FIELDS = new Set(['title', 'description']);
const TEXT_SUBTASK_FIELDS = new Set(['title']);
const WORD_BOUNDARY_RE = /[\s.,;:!?…\n\r]$/;

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}

export function getUpdateCardDeltaKeys(action) {
    if (action?.type !== 'UPDATE_CARD') return [];
    return Object.keys(action.payload?.updates || {}).filter((k) => k !== 'updatedAt');
}

export function getUpdateSubtaskDeltaKeys(action) {
    if (action?.type !== 'UPDATE_SUBTASK') return [];
    return Object.keys(action.payload?.updates || {}).filter(
        (k) => k !== 'updatedAt' && k !== 'position',
    );
}

export function isTextOnlyCardDelta(keys) {
    return keys.length > 0 && keys.every((k) => TEXT_CARD_FIELDS.has(k));
}

export function isTextOnlySubtaskDelta(keys) {
    return keys.length > 0 && keys.every((k) => TEXT_SUBTASK_FIELDS.has(k));
}

function textEditContinues(previousValue, newValue) {
    if (typeof previousValue !== 'string' || typeof newValue !== 'string') return false;
    return newValue.startsWith(previousValue) || previousValue.startsWith(newValue);
}

function endsWithWordBoundary(text) {
    return typeof text === 'string' && WORD_BOUNDARY_RE.test(text);
}

function cardTextCoalesceAllowed(lastEntry, forward) {
    const lastKeys = getUpdateCardDeltaKeys(lastEntry.forward);
    const newKeys = getUpdateCardDeltaKeys(forward);
    if (!isTextOnlyCardDelta(lastKeys) || !isTextOnlyCardDelta(newKeys)) return false;

    for (const field of TEXT_CARD_FIELDS) {
        const prev = lastEntry.forward.payload?.updates?.[field];
        const next = forward.payload?.updates?.[field];
        if (prev === undefined && next === undefined) continue;
        if (prev === undefined || next === undefined) return textEditContinues(prev ?? '', next ?? '');
        if (endsWithWordBoundary(prev)) return false;
        if (!textEditContinues(prev, next)) return false;
    }
    return true;
}

function subtaskTextCoalesceAllowed(lastEntry, forward) {
    const lastKeys = getUpdateSubtaskDeltaKeys(lastEntry.forward);
    const newKeys = getUpdateSubtaskDeltaKeys(forward);
    if (!isTextOnlySubtaskDelta(lastKeys) || !isTextOnlySubtaskDelta(newKeys)) return false;

    const prev = lastEntry.forward.payload?.updates?.title;
    const next = forward.payload?.updates?.title;
    if (prev === undefined || next === undefined) return textEditContinues(prev ?? '', next ?? '');
    if (endsWithWordBoundary(prev)) return false;
    return textEditContinues(prev, next);
}

export function canCoalesceWithLastEntry(lastEntry, forward, now = Date.now()) {
    if (!lastEntry || now - lastEntry.ts > HISTORY_COALESCE_MS) return false;

    if (forward.type === 'UPDATE_CARD' && lastEntry.forward?.type === 'UPDATE_CARD') {
        if (forward.payload?.cardId !== lastEntry.forward?.payload?.cardId) return false;
        return cardTextCoalesceAllowed(lastEntry, forward);
    }

    if (forward.type === 'UPDATE_SUBTASK' && lastEntry.forward?.type === 'UPDATE_SUBTASK') {
        if (forward.payload?.cardId !== lastEntry.forward?.payload?.cardId) return false;
        if (forward.payload?.subtaskId !== lastEntry.forward?.payload?.subtaskId) return false;
        return subtaskTextCoalesceAllowed(lastEntry, forward);
    }

    return false;
}

export function mergeCoalescedForward(lastEntry, forward) {
    if (forward.type === 'UPDATE_CARD') {
        return {
            ...forward,
            payload: {
                ...forward.payload,
                updates: {
                    ...lastEntry.forward.payload.updates,
                    ...forward.payload.updates,
                },
            },
        };
    }
    if (forward.type === 'UPDATE_SUBTASK') {
        return {
            ...forward,
            payload: {
                ...forward.payload,
                updates: {
                    ...lastEntry.forward.payload.updates,
                    ...forward.payload.updates,
                },
            },
        };
    }
    return forward;
}

export function mergeTextHistoryForward(pendingForward, nextAction) {
    return mergeCoalescedForward({ forward: pendingForward }, nextAction);
}

export function historyDebounceKey(boardId, action) {
    if (action?.type === 'UPDATE_SUBTASK') {
        return `${boardId}:${action.type}:${action.payload?.cardId}:${action.payload?.subtaskId}`;
    }
    return `${boardId}:${action.type}:${action.payload?.cardId || ''}:${action.payload?.listId || ''}`;
}

export function stashTextHistoryPending(pendingMap, boardId, boardBefore, action) {
    const key = historyDebounceKey(boardId, action);
    const existing = pendingMap.get(key);
    if (!existing) {
        pendingMap.set(key, {
            boardId,
            boardBefore: cloneJson(boardBefore),
            forward: cloneJson(action),
        });
        return;
    }
    existing.forward = mergeTextHistoryForward(existing.forward, action);
}
