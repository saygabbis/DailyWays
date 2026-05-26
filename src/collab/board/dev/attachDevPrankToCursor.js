/**
 * DEV ONLY — handlers no cursor remoto (arrastar + menu apagar mouse).
 */
import {
    isBoardDevPrankEnabled,
    useBoardDevPrankStore,
    clientToBoardContentPoint,
    emitDevPrankFreeze,
    emitDevPrankHold,
    emitDevPrankDragCursor,
} from './boardDevPrank.js';
import { getCollabSocket } from '../../core/collabClient.js';

const PRANK_ATTR = 'data-dw-dev-prank';
const DRAG_EMIT_MS = 32;

function applyDragPoint(userId, scrollerEl, clientX, clientY, boardId) {
    const point = clientToBoardContentPoint(scrollerEl, clientX, clientY);
    useBoardDevPrankStore.getState().setCursorOverride(userId, point);
    if (boardId) {
        emitDevPrankDragCursor(getCollabSocket(), boardId, userId, point);
    }
    return point;
}

/**
 * @param {HTMLElement} el
 * @param {{ userId: string, name?: string }} peer
 * @param {{ boardScroller: HTMLElement|null, boardId: string|null, showContextMenu?: Function }} opts
 */
export function attachDevPrankToCursor(el, peer, opts = {}) {
    if (!isBoardDevPrankEnabled() || !el || !peer?.userId) return () => {};

    const { boardScroller, boardId, showContextMenu } = opts;
    const userId = peer.userId;

    el.classList.add('collab-presence-cursor--dev-prank');
    el.style.pointerEvents = 'auto';
    el.setAttribute(PRANK_ATTR, userId);

    let activePointerId = null;
    let lastDragEmitAt = 0;

    const endDrag = (clearOverride = true) => {
        if (activePointerId == null) return;
        const pid = activePointerId;
        activePointerId = null;
        useBoardDevPrankStore.getState().setDraggingUserId(null);
        if (boardId) emitDevPrankHold(getCollabSocket(), boardId, userId, false);
        try {
            if (el.hasPointerCapture(pid)) el.releasePointerCapture(pid);
        } catch {
            /* ignore */
        }
        window.removeEventListener('pointermove', onPointerMove, true);
        window.removeEventListener('pointerup', onPointerUp, true);
        window.removeEventListener('pointercancel', onPointerUp, true);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        if (clearOverride) {
            useBoardDevPrankStore.getState().clearCursorOverride(userId);
        }
    };

    const onPointerMove = (e) => {
        if (activePointerId == null || e.pointerId !== activePointerId) return;
        if (!boardScroller) return;
        e.preventDefault();
        const now = Date.now();
        if (now - lastDragEmitAt < DRAG_EMIT_MS) {
            const point = clientToBoardContentPoint(boardScroller, e.clientX, e.clientY);
            useBoardDevPrankStore.getState().setCursorOverride(userId, point);
            return;
        }
        lastDragEmitAt = now;
        applyDragPoint(userId, boardScroller, e.clientX, e.clientY, boardId);
    };

    const onPointerUp = (e) => {
        if (activePointerId == null || e.pointerId !== activePointerId) return;
        endDrag(true);
    };

    const onPointerDown = (e) => {
        if (e.button !== 0 || activePointerId != null) return;
        e.preventDefault();
        e.stopPropagation();
        if (!boardScroller) return;

        activePointerId = e.pointerId;
        try {
            el.setPointerCapture(e.pointerId);
        } catch {
            /* fallback: window listeners still work */
        }

        useBoardDevPrankStore.getState().setDraggingUserId(userId);
        if (boardId) emitDevPrankHold(getCollabSocket(), boardId, userId, true);
        lastDragEmitAt = 0;
        applyDragPoint(userId, boardScroller, e.clientX, e.clientY, boardId);

        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';

        window.addEventListener('pointermove', onPointerMove, true);
        window.addEventListener('pointerup', onPointerUp, true);
        window.addEventListener('pointercancel', onPointerUp, true);
    };

    const onContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!showContextMenu) return;
        const label = peer.name || 'Colega';
        showContextMenu(
            e,
            [
                {
                    label: `🧪 Apagar mouse de ${label} (dev)`,
                    type: 'danger',
                    action: () => {
                        endDrag(false);
                        useBoardDevPrankStore.getState().hidePeer(userId);
                        if (boardId) {
                            emitDevPrankFreeze(getCollabSocket(), boardId, userId);
                        }
                    },
                },
            ],
            { title: 'Dev prank' },
        );
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('contextmenu', onContextMenu);

    return () => {
        if (useBoardDevPrankStore.getState().draggingUserId === userId) {
            endDrag(false);
        }
        el.classList.remove('collab-presence-cursor--dev-prank');
        el.style.pointerEvents = '';
        el.removeAttribute(PRANK_ATTR);
        el.removeEventListener('pointerdown', onPointerDown);
        el.removeEventListener('contextmenu', onContextMenu);
    };
}
