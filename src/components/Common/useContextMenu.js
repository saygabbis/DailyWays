import { useRef, useCallback, createContext, useContext } from 'react';

const MOVE_CANCEL_PX = 12;

export const ContextMenuContext = createContext(null);

export const useContextMenu = () => {
    const ctx = useContext(ContextMenuContext);
    if (!ctx) throw new Error('useContextMenu must be used within ContextMenuProvider');
    return ctx;
};

export function useLongPressSelect({ onSelect, elementRef, disabled = false, onPendingChange }) {
    const timerRef = useRef(null);
    const posRef = useRef({ x: 0, y: 0 });
    const pendingRef = useRef(false);
    const onSelectRef = useRef(onSelect);
    const onPendingRef = useRef(onPendingChange);
    onSelectRef.current = onSelect;
    onPendingRef.current = onPendingChange;

    const resolveMs = useCallback(() => {
        if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) return 550;
        return 550;
    }, []);

    const cancel = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (pendingRef.current) {
            pendingRef.current = false;
            onPendingRef.current?.(false);
        }
    }, []);

    const start = useCallback((e) => {
        if (disabled) return;
        const touch = e.touches?.[0];
        if (!touch) return;
        posRef.current = { x: touch.clientX, y: touch.clientY };
        pendingRef.current = false;
        timerRef.current = setTimeout(() => {
            pendingRef.current = true;
            onPendingRef.current?.(true);
        }, resolveMs());
    }, [disabled, resolveMs]);

    const onTouchMove = useCallback((e) => {
        if (disabled) return;
        const touch = e.touches?.[0];
        if (!touch) return;
        const dx = touch.clientX - posRef.current.x;
        const dy = touch.clientY - posRef.current.y;
        if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) {
            cancel();
        }
    }, [cancel, disabled]);

    const onTouchEnd = useCallback((e) => {
        const touch = e.changedTouches?.[0];
        const wasPending = pendingRef.current;
        cancel();
        if (!wasPending || disabled || !touch) return;
        const el = elementRef?.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const inside = touch.clientX >= rect.left && touch.clientX <= rect.right
            && touch.clientY >= rect.top && touch.clientY <= rect.bottom;
        if (inside) {
            e.preventDefault();
            e.stopPropagation();
            onSelectRef.current?.();
        }
    }, [cancel, disabled, elementRef]);

    const onTouchCancel = useCallback(() => {
        cancel();
    }, [cancel]);

    if (disabled) {
        return {
            cancel,
            onTouchStart: undefined,
            onTouchEnd: undefined,
            onTouchMove: undefined,
            onTouchCancel: undefined,
        };
    }

    return {
        cancel,
        onTouchStart: start,
        onTouchEnd,
        onTouchMove,
        onTouchCancel,
    };
}
