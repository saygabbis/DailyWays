import React, { useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { usePresenceStore } from '../presence/presenceStore';
import { useCollab } from '../../core/CollabContext.jsx';
import { presenceLabelTextColor } from '../../../utils/presenceLabelContrast.js';
import { getPeerCursorVariant } from '../presence/presenceInteraction.js';
import { screenCoordsToFixedLayer } from '../coords/pointerViewport.js';
import { taskModalCursorToViewport } from '../coords/taskModalCursorCoords.js';
import { overlayScrollCursorToViewport } from '../coords/overlayScrollCursorCoords.js';
import {
  boardContentCursorPosition,
  boardContentCursorToViewport,
} from '../coords/boardCursorCoords.js';
import { getBoardPresenceLayerAnchor } from '../coords/scrollContentCoords.js';
import { createRemoteCursorSmoother } from '../presence/remoteCursorSmoother.js';
import './PresenceLayer.css';

const POINTER_PATH = 'M2 2 L2 17 L7 12 L10.5 21 L13 19.5 L9.5 11.5 L16 11.5 Z';
const HAND_POINTER_PATH = 'M7 3 C7 3 5 5 5 8 L5 11 L3 11 C3 11 2 12 2 14 C2 16 4 17 4 17 L4 20 C4 22 6 23 8 23 L11 23 L11 20 L14 20 L14 17 L17 17 L17 14 L20 14 L20 11 L17 11 L17 8 C17 6 15 4 13 4 L11 4 L11 3 Z';
const GRAB_PATH = 'M8 4 C6 4 5 6 5 8 L5 12 L3 12 C2 12 1 13 1 15 C1 17 3 18 5 18 L5 21 C5 23 7 24 9 24 L12 24 L12 21 L15 21 L15 18 L18 18 L18 15 L21 15 L21 12 L18 12 L18 9 L15 9 L15 6 C15 4 13 4 11 4 L9 4 Z';

function toWorldScreen(cursor, panX, panY, zoom) {
  if (!cursor) return null;
  return { x: cursor.x * zoom + panX, y: cursor.y * zoom + panY };
}

function isPeerOnBoardContent(peer) {
  return peer?.onBoardSurface !== false && !peer?.selectedCardId && !peer?.cursorModal;
}

/** Posição em viewport: conteúdo (board/modal) primeiro; clientX/Y só para backdrop. */
function resolveViewportPosition(
  peer,
  remoteCursors,
  mode,
  panX,
  panY,
  zoom,
  modalRoot,
  overlayScrollSelector,
  boardScroller,
) {
  const remote = remoteCursors[peer.userId];
  const cur = remote ?? peer.cursor;
  if (mode === 'screen') {
    const cm = peer.cursorModal;
    if (cm && modalRoot) {
      const fromModal = cm.region === 'main'
        ? overlayScrollCursorToViewport(cm, modalRoot, overlayScrollSelector)
        : taskModalCursorToViewport(cm, modalRoot);
      if (fromModal) return fromModal;
      return null;
    }
    if (boardScroller && isPeerOnBoardContent(peer)) {
      const fromBoard = boardContentCursorToViewport(peer, boardScroller);
      if (fromBoard) return fromBoard;
      return null;
    }
    if (peer?.cursor?.space === 'board') return null;
    const cs = remote?.cursorScreen ?? peer.cursorScreen;
    if (cs && typeof cs.x === 'number' && typeof cs.y === 'number') {
      return screenCoordsToFixedLayer({ x: cs.x, y: cs.y });
    }
    return null;
  }
  return toWorldScreen(cur, panX, panY, zoom);
}

function resolvePeerCursorTarget(
  peer,
  {
    remoteCursors,
    mode,
    panX,
    panY,
    zoom,
    modalRoot,
    overlayScrollSelector,
    boardScroller,
    useBoardContentCoords,
  },
) {
  if (useBoardContentCoords && boardScroller && isPeerOnBoardContent(peer)) {
    return boardContentCursorPosition(peer, boardScroller);
  }
  return resolveViewportPosition(
    peer,
    remoteCursors,
    mode,
    panX,
    panY,
    zoom,
    modalRoot,
    overlayScrollSelector,
    boardScroller,
  );
}

/**
 * Remote cursors: meta from peers (rare updates), positions from remoteCursors (per frame, isolated).
 */
export default function CollabPresenceLayer({
  mode = 'world',
  viewport,
  elevated = false,
  peerFilter,
  /** Ref ou getter do root do overlay (modal) para coords com scroll. */
  modalRootRef = null,
  /** Seletor do painel scrollável em overlay genérico (lista). */
  overlayScrollSelector = null,
  /** Incrementa ao rolar overlay local — repinta cursores remotos. */
  scrollRepaint = 0,
  /** Ref do `.board-scroller` — coords de conteúdo + scroll. */
  boardScrollerRef = null,
  /** Scroll/resize do board (sidebar, janela, etc.). */
  layoutRepaint = 0,
}) {
  const useBoardContentCoords = Boolean(boardScrollerRef);
  const peers = usePresenceStore((s) => s.peers);
  const collab = useCollab();
  const myId = collab?.userId;
  const layerRef = useRef(null);
  const nodeRefs = useRef(new Map());
  const viewportRef = useRef(viewport);
  const smootherRef = useRef(null);
  const visibleMetaRef = useRef([]);
  const scrollRepaintRef = useRef(scrollRepaint);
  const layoutRepaintRef = useRef(layoutRepaint);
  scrollRepaintRef.current = scrollRepaint;
  layoutRepaintRef.current = layoutRepaint;

  if (!smootherRef.current) {
    smootherRef.current = createRemoteCursorSmoother();
  }

  viewportRef.current = viewport;
  const { panX = 0, panY = 0, zoom = 1 } = viewport || {};

  const visibleMeta = useMemo(() => {
    if (!collab?.connected || !peers?.length) return [];
    const out = peers
      .filter((p) => p.userId && p.userId !== myId)
      .filter((p) => (peerFilter ? peerFilter(p) : true));
    return out;
  }, [peers, myId, peerFilter, collab?.connected]);

  visibleMetaRef.current = visibleMeta;

  const applyCursorVariantToNode = (el, peer) => {
    const variant = getPeerCursorVariant(peer);
    el.dataset.cursorVariant = variant;
    el.classList.toggle('collab-presence-cursor--pointer', variant === 'pointer');
    el.classList.toggle('collab-presence-cursor--grabbing', variant === 'grabbing');
    const label = el.querySelector('.collab-presence-label');
    if (label) {
      label.style.display = variant === 'grabbing' ? 'none' : '';
    }
    const path = el.querySelector('.collab-presence-pointer path');
    if (!path) return;
    const d = variant === 'grabbing' ? GRAB_PATH : (variant === 'pointer' ? HAND_POINTER_PATH : POINTER_PATH);
    path.setAttribute('d', d);
  };

  const applyPeerMetaToNode = (el, peer) => {
    const color = peer.color || '#7c3aed';
    const displayName = peer.name || peer.avatarInitial || 'Usuário';
    el.style.setProperty('--presence-color', color);
    const label = el.querySelector('.collab-presence-label');
    if (label) {
      label.textContent = displayName;
      label.style.background = color;
      label.style.color = presenceLabelTextColor(color);
    }
    const path = el.querySelector('.collab-presence-pointer path');
    if (path) path.setAttribute('fill', color);
    applyCursorVariantToNode(el, peer);
  };

  const isNodeInLayer = (el, layer) => {
    if (!el || !layer) return false;
    return el.isConnected && layer.contains(el);
  };

  const createCursorNode = (peer) => {
    const color = peer.color || '#7c3aed';
    const el = document.createElement('div');
    el.className = 'collab-presence-cursor';
    el.dataset.userId = peer.userId;
    el.style.setProperty('--presence-color', color);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'collab-presence-pointer');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '24');
    svg.setAttribute('viewBox', '0 0 20 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', POINTER_PATH);
    path.setAttribute('fill', color);
    path.setAttribute('stroke', '#fff');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    el.appendChild(svg);
    const label = document.createElement('span');
    label.className = 'collab-presence-label';
    label.style.background = color;
    label.style.color = presenceLabelTextColor(color);
    label.textContent = peer.name || peer.avatarInitial || 'Usuário';
    el.appendChild(label);
    return el;
  };

  useEffect(() => () => {
    smootherRef.current?.clear();
    for (const el of nodeRefs.current.values()) {
      el.remove();
    }
    nodeRefs.current.clear();
  }, []);

  useEffect(() => {
    if (!useBoardContentCoords) return undefined;
    const layer = layerRef.current;
    const scroller = boardScrollerRef?.current;
    if (!layer || !scroller) return undefined;
    const syncAnchor = () => {
      const anchor = getBoardPresenceLayerAnchor(scroller);
      layer.style.left = `${anchor.offsetLeft}px`;
      layer.style.top = `${anchor.offsetTop}px`;
      if (anchor.width != null) layer.style.width = `${anchor.width}px`;
      if (anchor.height != null) layer.style.height = `${anchor.height}px`;
    };
    syncAnchor();
    const lists = scroller.querySelector('.board-lists');
    const ro = lists && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(syncAnchor)
      : null;
    ro?.observe(lists);
    return () => ro?.disconnect();
  }, [useBoardContentCoords, boardScrollerRef, layoutRepaint]); // layoutRepaint: re-anchor on board layout changes

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    const metaIds = new Set(visibleMeta.map((p) => p.userId));
    for (const id of [...nodeRefs.current.keys()]) {
      if (!metaIds.has(id)) {
        smootherRef.current?.remove(id);
        nodeRefs.current.get(id)?.remove();
        nodeRefs.current.delete(id);
      }
    }

    for (const peer of visibleMeta) {
      let el = nodeRefs.current.get(peer.userId);
      if (!isNodeInLayer(el, layer)) {
        if (el) {
          el.remove();
          nodeRefs.current.delete(peer.userId);
        }
        el = createCursorNode(peer);
        layer.appendChild(el);
        nodeRefs.current.set(peer.userId, el);
      } else if (!el) {
        el = createCursorNode(peer);
        layer.appendChild(el);
        nodeRefs.current.set(peer.userId, el);
      } else {
        applyPeerMetaToNode(el, peer);
      }
      applyCursorVariantToNode(el, peer);
    }
  }, [visibleMeta]);

  useEffect(() => {
    if (!collab?.connected || !visibleMeta.length) return undefined;

    let rafId = 0;
    const smoother = smootherRef.current;

    const frame = () => {
      rafId = 0;
      // scrollRepaint/layoutRepaint refs: scroll/layout bump without restarting this loop
      void scrollRepaintRef.current;
      void layoutRepaintRef.current;
      const meta = visibleMetaRef.current;
      if (!meta.length) return;

      const { remoteCursors, peers: storePeers } = usePresenceStore.getState();
      const { panX: px = 0, panY: py = 0, zoom: z = 1 } = viewportRef.current || {};
      const modalRoot = modalRootRef?.current ?? null;
      const boardScroller = boardScrollerRef?.current ?? null;
      const peerById = new Map((storePeers || []).map((p) => [p.userId, p]));
      const ctx = {
        remoteCursors,
        mode,
        panX: px,
        panY: py,
        zoom: z,
        modalRoot,
        overlayScrollSelector,
        boardScroller,
        useBoardContentCoords,
      };

      for (const peer of meta) {
        const el = nodeRefs.current.get(peer.userId);
        if (!el) continue;

        const fullPeer = peerById.get(peer.userId) || peer;
        const targetPos = resolvePeerCursorTarget(fullPeer, ctx);
        if (!targetPos) {
          smoother.remove(peer.userId);
          el.style.display = 'none';
          continue;
        }

        smoother.updateTarget(peer.userId, targetPos);
      }

      smoother.tick();

      for (const peer of meta) {
        const el = nodeRefs.current.get(peer.userId);
        if (!el) continue;

        const fullPeer = peerById.get(peer.userId) || peer;
        const pos = smoother.getPosition(peer.userId);
        if (!pos) {
          el.style.display = 'none';
          continue;
        }

        el.style.display = '';
        el.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
        applyCursorVariantToNode(el, fullPeer);
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [
    collab?.connected,
    visibleMeta.length,
    mode,
    panX,
    panY,
    zoom,
    useBoardContentCoords,
    modalRootRef,
    overlayScrollSelector,
    boardScrollerRef,
  ]);

  if (!collab?.connected || !visibleMeta.length) return null;

  const useViewportPortal = mode === 'screen' && !useBoardContentCoords;
  const layer = (
    <div
      ref={layerRef}
      className={[
        'collab-presence-layer',
        useBoardContentCoords ? 'collab-presence-layer--board-content' : '',
        useViewportPortal ? 'collab-presence-layer--viewport' : 'collab-presence-layer--embedded',
        elevated ? 'collab-presence-layer--elevated' : '',
      ].filter(Boolean).join(' ')}
      aria-hidden
    />
  );

  if (useViewportPortal && typeof document !== 'undefined') {
    return createPortal(layer, document.body);
  }
  return layer;
}
