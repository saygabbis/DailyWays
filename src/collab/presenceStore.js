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

function hasCursorCoords(c) {
  return c && typeof c.x === 'number' && typeof c.y === 'number';
}

function hasCursorScreenCoords(cs) {
  return cs && typeof cs.x === 'number' && typeof cs.y === 'number';
}

/** Evita que um PRESENCE_SYNC antigo (JOIN sem cursor) apague coords já recebidas. */
function mergePeersPreservingCursor(prevPeers, incoming) {
  const prevById = new Map((prevPeers || []).map((p) => [p.userId, p]));
  const next = (incoming || []).filter(Boolean).map((p) => {
    const prev = prevById.get(p.userId);
    if (!prev) return p;
    const merged = { ...prev, ...p };
    if (!hasCursorCoords(p.cursor) && hasCursorCoords(prev.cursor)) {
      merged.cursor = { ...prev.cursor };
    }
    if (!hasCursorScreenCoords(p.cursorScreen) && hasCursorScreenCoords(prev.cursorScreen)) {
      merged.cursorScreen = { ...prev.cursorScreen };
    }
    return merged;
  });
  return next;
}

function extractRemoteCursors(peers) {
  const out = {};
  for (const p of peers) {
    if (!p?.userId || !hasCursorCoords(p.cursor)) continue;
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
    const state = usePresenceStore.getState();
    const next = normalizePeers(mergePeersPreservingCursor(state.peers, peers));
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
        cursorFrame: (metaChanged || cursorChanged) ? state.cursorFrame + 1 : state.cursorFrame,
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
