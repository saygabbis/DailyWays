import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Circle, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { useBoardPresenceHighlights } from '../../../hooks/useBoardPresenceHighlights';
import { usePresenceStore } from '../presence/presenceStore';
import { presenceLabelTextColor } from '../../../utils/presenceLabelContrast.js';
import { boardContentCursorToViewport } from '../coords/boardCursorCoords.js';
import { viewportFromContentPoint } from '../coords/scrollContentCoords.js';
import './PresenceLayer.css';

const CARD_OFFSET_X = 14;
const CARD_OFFSET_Y = 20;
const LIST_OFFSET_X = 18;
const LIST_OFFSET_Y = 24;

function resolveDragScreenPosition(drag, peers, scrollerEl, offsetX, offsetY) {
  const peer = peers.find((p) => p.userId === drag.userId);
  if (peer && scrollerEl) {
    const fromBoard = boardContentCursorToViewport(peer, scrollerEl);
    if (fromBoard) {
      return { x: fromBoard.x + offsetX, y: fromBoard.y + offsetY };
    }
    return null;
  }
  if (typeof drag.x === 'number' && typeof drag.y === 'number' && scrollerEl) {
    const pos = viewportFromContentPoint(scrollerEl, drag.x, drag.y);
    if (pos) return { x: pos.x + offsetX, y: pos.y + offsetY };
  }
  return null;
}

function PeerBadge({ drag, color }) {
  return (
    <span
      className="collab-remote-drag-ghost-badge"
      style={{
        background: color,
        color: presenceLabelTextColor(color),
      }}
      title={drag.name || undefined}
    >
      {drag.name || drag.avatarInitial || 'Usuário'}
    </span>
  );
}

function CardGhost({ card, drag, color, pos }) {
  const isCompleted = Boolean(card.completed);
  return (
    <div
      className="collab-remote-drag-ghost"
      style={{
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        '--presence-color': color,
      }}
    >
      <div className="collab-remote-drag-ghost-card collab-remote-drag-ghost-card--active">
        <PeerBadge drag={drag} color={color} />
        <div className="collab-remote-drag-ghost-card-header">
          <span
            className={`collab-remote-drag-ghost-check${isCompleted ? ' collab-remote-drag-ghost-check--done' : ''}`}
            aria-hidden
          >
            {isCompleted ? <CheckCircle2 size={16} strokeWidth={2} /> : <Circle size={16} strokeWidth={2} />}
          </span>
          <span className={`collab-remote-drag-ghost-title${isCompleted ? ' collab-remote-drag-ghost-title--done' : ''}`}>
            {card.title || 'Tarefa'}
          </span>
        </div>
      </div>
    </div>
  );
}

function ListGhost({ list, drag, color, pos }) {
  const previewCards = (list.cards || []).slice(0, 3);
  return (
    <div
      className="collab-remote-drag-ghost"
      style={{
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        '--presence-color': color,
      }}
    >
      <div className="collab-remote-drag-ghost-list collab-remote-drag-ghost-list--active">
        <PeerBadge drag={drag} color={color} />
        <div className="collab-remote-drag-ghost-list-header">
          <h4 className="collab-remote-drag-ghost-list-title">{list.title || 'Lista'}</h4>
          <span className="collab-remote-drag-ghost-list-count">{list.cards?.length ?? 0}</span>
        </div>
        {previewCards.length > 0 && (
          <div className="collab-remote-drag-ghost-list-cards">
            {previewCards.map((card) => {
              const done = Boolean(card.completed);
              return (
                <div
                  key={card.id}
                  className={`collab-remote-drag-ghost-list-card${done ? ' collab-remote-drag-ghost-list-card--done' : ''}`}
                >
                  <span className="collab-remote-drag-ghost-list-card-check" aria-hidden>
                    {done ? <CheckCircle2 size={12} strokeWidth={2} /> : <Circle size={12} strokeWidth={2} />}
                  </span>
                  <span className="collab-remote-drag-ghost-list-card-title">{card.title || 'Tarefa'}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Ghost cards/lists that follow remote peers while they drag.
 */
export default function RemoteDragLayer({ boardId, boardScrollerRef = null, layoutRepaint = 0 }) {
  const { state } = useApp();
  const { remoteDrags, remoteListDrags } = useBoardPresenceHighlights();
  const cursorFrame = usePresenceStore((s) => s.cursorFrame);
  const peers = usePresenceStore((s) => s.peers);

  const boardData = useMemo(() => {
    const board = state.boards.find((b) => b.id === boardId);
    if (!board) return { cardsById: {}, listsById: {} };
    const cardsById = {};
    const listsById = {};
    for (const list of board.lists) {
      listsById[list.id] = list;
      for (const card of list.cards) {
        cardsById[card.id] = card;
      }
    }
    return { cardsById, listsById };
  }, [state.boards, boardId]);

  const { cardGhosts, listGhosts } = useMemo(() => {
    void cursorFrame;
    void layoutRepaint;
    const scrollerEl = boardScrollerRef?.current ?? null;
    const cards = [];
    const lists = [];

    for (const drag of remoteDrags) {
      const card = boardData.cardsById[drag.cardId];
      if (!card) continue;
      const pos = resolveDragScreenPosition(drag, peers, scrollerEl, CARD_OFFSET_X, CARD_OFFSET_Y);
      if (!pos) continue;
      cards.push({
        key: `card-${drag.userId}-${drag.cardId}`,
        card,
        drag,
        color: drag.color || '#7c3aed',
        pos,
      });
    }

    for (const drag of remoteListDrags) {
      const list = boardData.listsById[drag.listId];
      if (!list) continue;
      const pos = resolveDragScreenPosition(drag, peers, scrollerEl, LIST_OFFSET_X, LIST_OFFSET_Y);
      if (!pos) continue;
      lists.push({
        key: `list-${drag.userId}-${drag.listId}`,
        list,
        drag,
        color: drag.color || '#7c3aed',
        pos,
      });
    }

    return { cardGhosts: cards, listGhosts: lists };
  }, [
    remoteDrags,
    remoteListDrags,
    boardData,
    peers,
    cursorFrame,
    layoutRepaint,
    boardScrollerRef,
  ]);

  if (!cardGhosts.length && !listGhosts.length) return null;

  const layer = (
    <div className="collab-remote-drag-layer collab-remote-drag-layer--viewport" aria-hidden>
      {listGhosts.map(({ key, list, drag, color, pos }) => (
        <ListGhost key={key} list={list} drag={drag} color={color} pos={pos} />
      ))}
      {cardGhosts.map(({ key, card, drag, color, pos }) => (
        <CardGhost key={key} card={card} drag={drag} color={color} pos={pos} />
      ))}
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(layer, document.body);
  }
  return layer;
}
