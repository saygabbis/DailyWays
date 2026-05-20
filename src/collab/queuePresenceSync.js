import { usePresenceStore } from './presenceStore.js';

let pendingPeers = null;
let rafId = 0;

/** Coalesce presence sync to one store update per display frame (smoother on slower clients). */
export function queuePresenceSync(peers) {
  pendingPeers = peers;
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    const batch = pendingPeers;
    pendingPeers = null;
    if (batch) usePresenceStore.getState().setPeers(batch);
  });
}

export function flushPresenceSyncNow(peers) {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  pendingPeers = null;
  if (peers) usePresenceStore.getState().setPeers(peers);
}
