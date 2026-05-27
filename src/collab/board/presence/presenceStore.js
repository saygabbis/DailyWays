import { create } from 'zustand';

function normalizePeers(peers) {
  return (peers || []).filter(Boolean).map((p) => ({
    ...p,
    cursor: p.cursor ? { ...p.cursor } : p.cursor,
    cursorScreen: p.cursorScreen ? { ...p.cursorScreen } : p.cursorScreen,
    cursorModal: p.cursorModal ? { ...p.cursorModal } : p.cursorModal,
    draggingNodeIds: Array.isArray(p.draggingNodeIds) ? [...p.draggingNodeIds] : [],
    dragPreviewRects: Array.isArray(p.dragPreviewRects)
      ? p.dragPreviewRects.map((rect) => ({ ...rect }))
      : [],
  }));
}

function modalCursorKey(cm) {
  if (!cm || typeof cm.x !== 'number' || typeof cm.y !== 'number') return '';
  return `${cm.region || ''}:${cm.x},${cm.y}`;
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
      + `${p.draggingListId || ''}:${p.hoverCardId || ''}:${p.hoverListId || ''}:${p.hoverUiKey || ''}:`
      + `${p.selectedCardId || ''}:${(p.selectedCardIds || []).join(',')}:${p.onBoardSurface === false ? 0 : 1}:`
      + `${p.hoverModalEl || ''}:${JSON.stringify(p.liveDraft ?? null)}:`
      + `${(p.selectedNodeIds || []).join(',')}:${(p.draggingNodeIds || []).join(',')}:`
      + `${JSON.stringify(p.dragPreviewRects || null)}`
    ))
    .sort()
    .join('|');
}

function cursorSignature(peers) {
  if (!peers?.length) return '';
  return peers
    .map((p) => `${p.userId}:${cursorKey(p.cursor)}:${cursorKey(p.cursorScreen)}:${modalCursorKey(p.cursorModal)}`)
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
    if (p.cursor?.space === 'board') {
      merged.cursorScreen = null;
    } else if (!hasCursorScreenCoords(p.cursorScreen) && hasCursorScreenCoords(prev.cursorScreen)) {
      merged.cursorScreen = { ...prev.cursorScreen };
    }
    if (p.cursorModal && typeof p.cursorModal.x === 'number') {
      merged.cursorModal = { ...p.cursorModal };
    } else if (p.selectedCardId) {
      if (prev.cursorModal) merged.cursorModal = { ...prev.cursorModal };
    } else {
      merged.cursorModal = null;
    }
    return merged;
  });
  return next;
}

function extractRemoteCursors(peers) {
  const out = {};
  for (const p of peers) {
    if (!p?.userId) continue;
    const c = p.cursor;
    if (c?.space !== 'board' || typeof c.x !== 'number' || typeof c.y !== 'number') continue;
    out[p.userId] = {
      x: c.x,
      y: c.y,
      mode: c.mode,
      cursorScreen: null,
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
