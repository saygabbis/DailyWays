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

      return {
        ...state,
        peers: next,
        remoteCursors: cursors,
        _metaSig: mSig,
        _cursorSig: cSig,
        cursorFrame: cursorChanged ? state.cursorFrame + 1 : state.cursorFrame,
      };
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
