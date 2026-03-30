import { useSyncExternalStore } from 'react';

function subscribe(cb) {
    if (typeof window === 'undefined') return () => {};
    const mq = window.matchMedia('(pointer: coarse)');
    mq.addEventListener('change', cb);
    return () => mq.removeEventListener('change', cb);
}

function getSnapshot() {
    return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
}

function getServerSnapshot() {
    return false;
}

/** Touch primário (telefone / tablet em modo touch) — DnD e gestos diferem do rato. */
export function useCoarsePointer() {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
