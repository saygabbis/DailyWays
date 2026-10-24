import { useCallback, useRef, useSyncExternalStore } from 'react';

const RECT_KEYS = ['left', 'top', 'width', 'height', 'right', 'bottom'];

function sameRect(a, b) {
    return !!a && !!b && RECT_KEYS.every((k) => a[k] === b[k]);
}

/**
 * Retângulo (getBoundingClientRect) do elemento de um ref, lido do DOM do jeito que o React permite
 * durante o render (useSyncExternalStore). Atualiza em resize do elemento/janela e em scroll;
 * devolve o MESMO objeto enquanto nada mudou, então não causa re-render à toa.
 */
export function useElementRect(ref) {
    const cacheRef = useRef(null);

    const subscribe = useCallback((notify) => {
        const el = ref?.current;
        const ro = el && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(notify) : null;
        if (ro) ro.observe(el);
        window.addEventListener('resize', notify, { passive: true });
        window.addEventListener('scroll', notify, { passive: true, capture: true });
        return () => {
            ro?.disconnect();
            window.removeEventListener('resize', notify);
            window.removeEventListener('scroll', notify, { capture: true });
        };
    }, [ref]);

    const getSnapshot = useCallback(() => {
        const el = ref?.current;
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (sameRect(cacheRef.current, r)) return cacheRef.current;
        cacheRef.current = { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom, x: r.x, y: r.y };
        return cacheRef.current;
    }, [ref]);

    return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

const noopSubscribe = () => () => {};

/** Elemento atual de um ref, legível durante o render (ex.: alvo de portal que monta depois). */
export function useRefElement(ref) {
    return useSyncExternalStore(noopSubscribe, () => ref?.current ?? null, () => null);
}
