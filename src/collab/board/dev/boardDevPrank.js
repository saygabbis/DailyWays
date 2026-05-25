/**
 * DEV ONLY — prank no board (contas DEV + toggle em Config DEV).
 */
import { create } from 'zustand';
import { boardListsContentPointFromClient, boardScreenPointFromContent } from '../coords/scrollContentCoords.js';
import { getPresenceFields } from '../presence/presenceBridge.js';
import { useDevConfigStore } from '../../../dev/devConfigStore.js';
import { isBoardPrankFeatureEnabled } from '../../../dev/devAccess.js';

const NUDGE = { x: 20, y: 20 };

let devPrankSession = { user: null, profile: null };

/** Sincronizado em AppContent a partir do AuthContext. */
export function setDevPrankSession(user, profile) {
    devPrankSession = { user: user || null, profile: profile || null };
}

export function isBoardDevPrankEnabled() {
    const config = useDevConfigStore.getState().config;
    return isBoardPrankFeatureEnabled(
        devPrankSession.user,
        devPrankSession.profile,
        config,
    );
}

export function isBoardPrankFrozen() {
    return useBoardDevPrankStore.getState().frozen;
}

export function setBoardPrankFrozen(value) {
    useBoardDevPrankStore.getState().setFrozen(Boolean(value));
}

export function isBoardPrankHeld() {
    return useBoardDevPrankStore.getState().held;
}

export function setBoardPrankHeld(value) {
    useBoardDevPrankStore.getState().setHeld(Boolean(value));
}

export const useBoardDevPrankStore = create((set, get) => ({
    frozen: false,
    held: false,

    setFrozen(frozen) {
        set({ frozen: Boolean(frozen) });
    },

    setHeld(held) {
        set({ held: Boolean(held) });
    },
    /** @type {string|null} */
    draggingUserId: null,
    /** @type {{ boardId: string, x: number, y: number } | null} */
    victimPuppetCursor: null,
    /** @type {Record<string, { x: number, y: number }>} */
    cursorOverrides: {},
    locallyHiddenIds: {},

    setDraggingUserId(userId) {
        set({ draggingUserId: userId || null });
    },

    isDraggingPeer(userId) {
        return get().draggingUserId === userId;
    },

    setCursorOverride(userId, point) {
        if (!userId || !point) return;
        set((s) => ({
            cursorOverrides: {
                ...s.cursorOverrides,
                [userId]: { x: point.x, y: point.y },
            },
        }));
    },

    clearCursorOverride(userId) {
        if (!userId) return;
        set((s) => {
            const next = { ...s.cursorOverrides };
            delete next[userId];
            return { cursorOverrides: next };
        });
    },

    hidePeer(userId) {
        if (!userId) return;
        set((s) => ({
            locallyHiddenIds: { ...s.locallyHiddenIds, [userId]: true },
        }));
    },

    isPeerHidden(userId) {
        return Boolean(get().locallyHiddenIds[userId]);
    },

    getDisplayPoint(userId, scrollerEl) {
        const o = get().cursorOverrides[userId];
        if (!o || !scrollerEl) return null;
        return { x: o.x + NUDGE.x, y: o.y + NUDGE.y };
    },

    setVictimPuppetCursor(boardId, point) {
        if (!boardId || !point) {
            set({ victimPuppetCursor: null });
            return;
        }
        set({
            victimPuppetCursor: {
                boardId,
                x: point.x,
                y: point.y,
            },
        });
    },

    clearVictimPuppetCursor() {
        set({ victimPuppetCursor: null });
    },
}));

/** Aplica cursor “fantoche” na vítima (tela dela segue o arraste). */
export function applyVictimPuppetCursor(boardId, x, y) {
    if (!boardId || typeof x !== 'number' || typeof y !== 'number') return;
    useBoardDevPrankStore.getState().setVictimPuppetCursor(boardId, { x, y });
    const scroller = typeof document !== 'undefined' ? document.querySelector('.board-scroller') : null;
    const fields = getPresenceFields(boardId);
    fields.cursor = { x, y, space: 'board' };
    fields.onBoardSurface = true;
    fields.cursorModal = null;
    if (scroller) {
        fields.cursorScreen = boardScreenPointFromContent(scroller, x, y);
    }
}

export function clientToBoardContentPoint(scrollerEl, clientX, clientY) {
    const p = boardListsContentPointFromClient(scrollerEl, clientX, clientY);
    return { x: p.x - NUDGE.x, y: p.y - NUDGE.y };
}

export function emitDevPrankFreeze(socket, boardId, targetUserId) {
    if (!socket?.connected || !boardId || !targetUserId) return;
    socket.emit('dev:prank', { boardId, targetUserId, action: 'freeze' });
}

export function emitDevPrankHold(socket, boardId, targetUserId, hold) {
    if (!socket?.connected || !boardId || !targetUserId) return;
    socket.emit('dev:prank', {
        boardId,
        targetUserId,
        action: hold ? 'hold' : 'release',
    });
}

export function emitDevPrankDragCursor(socket, boardId, targetUserId, point) {
    if (!socket?.connected || !boardId || !targetUserId || !point) return;
    socket.emit('dev:prank', {
        boardId,
        targetUserId,
        action: 'drag',
        x: point.x,
        y: point.y,
    });
}
