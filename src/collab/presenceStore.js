import { create } from 'zustand';

function normalizePeers(peers) {
  return (peers || []).filter(Boolean).map((p) => ({
    ...p,
    cursor: p.cursor ? { ...p.cursor } : p.cursor,
    cursorScreen: p.cursorScreen ? { ...p.cursorScreen } : p.cursorScreen,
  }));
}

function cursorKey(c) {
  if (!c || typeof c.x !== 'number' || typeof c.y !== 'number') return '';
  return `${c.x},${c.y}`;
}

function metaSignature(peers) {
  if (!peers?.length) return '';
  return peers
    .map((p) => (
      `${p.userId}:${p.name || ''}:${p.color || ''}:${p.draggingCardId || ''}:`
      + `${p.draggingListId || ''}:${p.hoverCardId || ''}:${p.hoverListId || ''}:`
      + `${p.selectedCardId || ''}`
    ))
    .sort()
    .join('|');
}

function cursorSignature(peers) {
  if (!peers?.length) return '';
  return peers
    .map((p) => `${p.userId}:${cursorKey(p.cursor)}`)
    .sort()
    .join('|');
}

function extractRemoteCursors(peers) {
  const out = {};
  for (const p of peers) {
    if (!p?.userId || !p.cursor) continue;
    if (typeof p.cursor.x !== 'number' || typeof p.cursor.y !== 'number') continue;
    out[p.userId] = {
      x: p.cursor.x,
      y: p.cursor.y,
      mode: p.cursor.mode,
      cursorScreen: p.cursorScreen ? { ...p.cursorScreen } : null,
    };
  }
  return out;
}

/** Patch cursor only on peers that need it for hover/drag UI (avoids full-board re-renders). */
function patchInteractiveCursors(prevPeers, nextPeers) {
  const nextById = new Map(nextPeers.map((p) => [p.userId, p]));
  let changed = false;
  const out = prevPeers.map((p) => {
    const n = nextById.get(p.userId);
    if (!n) return p;
    const needsCursor = p.draggingCardId || p.hoverCardId || p.hoverListId;
    if (!needsCursor) return p;
    const cx = cursorKey(p.cursor);
    const nx = cursorKey(n.cursor);
    if (cx === nx && p.cursorScreen === n.cursorScreen) return p;
    changed = true;
    return {
      ...p,
      cursor: n.cursor ? { ...n.cursor } : n.cursor,
      cursorScreen: n.cursorScreen ? { ...n.cursorScreen } : n.cursorScreen,
    };
  });
  return changed ? out : prevPeers;
}

export const usePresenceStore = create((set) => ({
  peers: [],
  remoteCursors: {},
  _metaSig: '',
  _cursorSig: '',
  cursorFrame: 0,

  setPeers: (peers) => {
    const next = normalizePeers(peers);
    const mSig = metaSignature(next);
    const cSig = cursorSignature(next);
    const cursors = extractRemoteCursors(next);

    set((state) => {
      const metaChanged = state._metaSig !== mSig;
      const cursorChanged = state._cursorSig !== cSig;
      if (!metaChanged && !cursorChanged) return state;

      const patch = {};
      if (cursorChanged) {
        patch.remoteCursors = cursors;
        patch._cursorSig = cSig;
        patch.cursorFrame = state.cursorFrame + 1;
      }
      if (metaChanged) {
        patch.peers = next;
        patch._metaSig = mSig;
      } else if (cursorChanged) {
        const prevIds = new Set((state.peers || []).map((p) => p.userId));
        const hasNewPeer = next.some((p) => p.userId && !prevIds.has(p.userId));
        if (hasNewPeer) {
          patch.peers = next;
        } else {
          const merged = patchInteractiveCursors(state.peers, next);
          if (merged !== state.peers) patch.peers = merged;
        }
      }
      return { ...state, ...patch };
    });
  },

  clearPeers: () => set({
    peers: [],
    remoteCursors: {},
    _metaSig: '',
    _cursorSig: '',
    cursorFrame: 0,
  }),

  updateLocalMeta: (meta) => set((state) => ({
    localMeta: { ...state.localMeta, ...meta },
  })),

  localMeta: null,
}));
