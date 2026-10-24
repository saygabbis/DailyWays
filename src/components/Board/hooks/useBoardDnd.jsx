/**
 * Arrastar e soltar do board (listas e cards) sobre o DnD global (src/dnd).
 *
 * Durante o arraste de um card entre listas, a tela usa uma PRÉVIA (`previewLists`): o card já
 * aparece na lista de destino e os outros abrem espaço. Nada vai para o estado/servidor até
 * soltar; aí sai UMA op (MOVE_CARD) com o índice final. Soltar fora / Esc → prévia descartada.
 */
import { useCallback, useState } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { useDndHandlers } from '../../../dnd/dndRegistry.js';
import { useBoardSelectionStore } from '../../../stores/boardSelectionStore';
import { pushPresenceFields } from '../../../collab/board/presence/presenceBridge.js';
import { publishBoardPresenceFull } from '../../../collab/board/presence/boardPresencePublish.js';
import { applyCompletionListUpdates } from '../../../utils/cardCompletion.js';
import { bulkMoveCardsToIndex, resolveSelectedCards } from '../boardCardBulkOps';
import BoardCard from '../BoardCard';
import BoardMultiDragStack from '../BoardMultiDragStack';

const cloneLists = (lists) => lists.map((l) => ({ ...l, cards: [...l.cards] }));
const listOfCard = (lists, cardId) => lists.find((l) => l.cards.some((c) => c.id === cardId));

export function useBoardDnd({ board, collabDispatch, collab, auth, setDroppedListId }) {
  const [drag, setDrag] = useState(null); // { type, activeId, fromListId, previewLists, multiIds }

  const publishPresence = useCallback((fields) => {
    if (!board?.id) return;
    pushPresenceFields(board.id, fields);
    if (collab?.socket?.connected) publishBoardPresenceFull(collab.socket, board.id, auth);
  }, [board?.id, collab?.socket, auth]);

  const end = useCallback(() => {
    setDrag(null);
    document.body.classList.remove('board-multi-drag-active');
    useBoardSelectionStore.getState().clearMultiDrag();
    publishPresence({ draggingCardId: null, draggingListId: null });
  }, [publishPresence]);

  /** Card arrastado para cima de outra lista: move na prévia (só quando muda de lista). */
  const moveInPreview = useCallback((activeId, over, activeRect) => {
    setDrag((d) => {
      if (!d || d.type !== 'card') return d;
      const lists = d.previewLists;
      const from = listOfCard(lists, activeId);
      if (!from) return d;
      const overData = over?.data?.current;
      let toListId = null;
      let toIndex = 0;
      if (overData?.kind === 'card') {
        const to = listOfCard(lists, overData.cardId);
        if (!to) return d;
        toListId = to.id;
        const overIndex = to.cards.findIndex((c) => c.id === overData.cardId);
        const below = activeRect && over.rect ? activeRect.top + activeRect.height / 2 > over.rect.top + over.rect.height / 2 : false;
        toIndex = overIndex + (below ? 1 : 0);
      } else if (overData?.kind === 'list-zone') {
        toListId = overData.listId;
        toIndex = lists.find((l) => l.id === toListId)?.cards.length ?? 0;
      } else {
        return d;
      }
      if (toListId === from.id) return d; // dentro da mesma lista o sortable cuida da animação
      const next = cloneLists(lists);
      const src = next.find((l) => l.id === from.id);
      const dst = next.find((l) => l.id === toListId);
      const [moved] = src.cards.splice(src.cards.findIndex((c) => c.id === activeId), 1);
      dst.cards.splice(Math.min(toIndex, dst.cards.length), 0, moved);
      return { ...d, previewLists: next };
    });
  }, []);

  useDndHandlers({
    card: {
      onStart: ({ active }) => {
        const { cardId, listId } = active.data.current;
        const store = useBoardSelectionStore.getState();
        store.beginMultiDrag(cardId);
        const multiIds = useBoardSelectionStore.getState().multiDragCardIds;
        if (multiIds.length > 1) document.body.classList.add('board-multi-drag-active');
        // Na prévia, os companheiros da seleção "viajam" com o card principal (saem das listas).
        const companions = new Set(multiIds.length > 1 ? multiIds.filter((id) => id !== cardId) : []);
        const previewLists = cloneLists(board.lists).map((l) => ({ ...l, cards: l.cards.filter((c) => !companions.has(c.id)) }));
        setDrag({ type: 'card', activeId: cardId, fromListId: listId, previewLists, multiIds });
        publishPresence({ draggingCardId: cardId, draggingListId: listId, selectedCardId: null, onBoardSurface: true });
      },
      onOver: ({ active, over }) => {
        if (!over) return;
        moveInPreview(active.id, over, active.rect.current.translated);
      },
      onEnd: ({ active, over }) => {
        const state = drag;
        try {
          if (!state || !over || !board) return;
          const cardId = active.id;
          const lists = state.previewLists;
          const dest = listOfCard(lists, cardId);
          if (!dest) return;
          const overData = over.data.current;
          let destIndex = dest.cards.findIndex((c) => c.id === cardId);
          if (overData?.kind === 'card' && overData.cardId !== cardId && dest.cards.some((c) => c.id === overData.cardId)) {
            destIndex = arrayMove(dest.cards, destIndex, dest.cards.findIndex((c) => c.id === overData.cardId))
              .findIndex((c) => c.id === cardId);
          }

          if (state.multiIds.length > 1) {
            const cards = resolveSelectedCards(board, state.multiIds);
            bulkMoveCardsToIndex(cards, dest.id, destIndex, cardId, () => board, collabDispatch);
            return;
          }

          const sourceList = board.lists.find((l) => l.id === state.fromListId);
          const sourceIndex = sourceList?.cards.findIndex((c) => c.id === cardId) ?? -1;
          if (sourceIndex < 0) return;
          if (sourceList.id === dest.id && sourceIndex === destIndex) return;
          const card = sourceList.cards[sourceIndex];
          collabDispatch({
            type: 'MOVE_CARD',
            payload: { boardId: board.id, cardId, sourceListId: sourceList.id, destListId: dest.id, sourceIndex, destIndex },
          });
          const destReal = board.lists.find((l) => l.id === dest.id);
          applyCompletionListUpdates(card, destReal, board.id, dest.id, collabDispatch);
        } finally {
          end();
        }
      },
      onCancel: () => end(),
      renderOverlay: (data) => {
        const list = board?.lists.find((l) => l.id === data.listId);
        const card = list?.cards.find((c) => c.id === data.cardId);
        if (!card) return null;
        const multi = drag?.multiIds?.length > 1 ? resolveSelectedCards(board, drag.multiIds) : [];
        return (
          <div className="board-card-overlay">
            {multi.length > 1 && (
              <BoardMultiDragStack count={multi.length} items={multi.filter((m) => m.card.id !== card.id).map((m) => ({ id: m.card.id, title: m.card.title }))} />
            )}
            <BoardCard card={card} boardId={board.id} listId={list.id} listColor={list.color} isDragging overlay />
          </div>
        );
      },
      announce: (type, a, o) => ({
        start: `Pegou a tarefa ${a?.title}.`,
        over: o?.kind === 'list-zone' ? 'Sobre outra lista.' : o?.kind === 'zone' ? 'Sobre um atalho da navegação.' : undefined,
        end: 'Tarefa solta.',
        cancel: 'Movimento cancelado; a tarefa voltou ao lugar.',
      })[type],
    },
    list: {
      onStart: ({ active }) => {
        setDrag({ type: 'list', activeId: active.id });
        publishPresence({ draggingListId: active.id, draggingCardId: null, selectedCardId: null, onBoardSurface: true });
      },
      onEnd: ({ active, over }) => {
        try {
          if (!over || !board || over.id === active.id || over.data.current?.kind !== 'list') return;
          const sourceIndex = board.lists.findIndex((l) => l.id === active.id);
          const destIndex = board.lists.findIndex((l) => l.id === over.id);
          if (sourceIndex < 0 || destIndex < 0) return;
          collabDispatch({ type: 'MOVE_LIST', payload: { boardId: board.id, listId: active.id, sourceIndex, destIndex } });
          setDroppedListId?.(active.id);
          setTimeout(() => setDroppedListId?.(null), 900);
        } finally {
          end();
        }
      },
      onCancel: () => end(),
      renderOverlay: (data) => {
        const list = board?.lists.find((l) => l.id === data.listId);
        if (!list) return null;
        return (
          <div className="board-list-overlay" style={list.color ? { '--list-accent': list.color } : undefined}>
            <div className="board-list-overlay-head">
              <span>{list.title}</span>
              <span className="board-list-count">{list.cards.length}</span>
            </div>
            {list.cards.slice(0, 4).map((c) => <div key={c.id} className="board-list-overlay-card">{c.title}</div>)}
            {list.cards.length > 4 && <div className="board-list-overlay-more">+{list.cards.length - 4}</div>}
          </div>
        );
      },
      announce: (type, a) => ({
        start: `Pegou a lista ${a?.title}.`,
        end: 'Lista solta.',
        cancel: 'Movimento cancelado.',
      })[type],
    },
  });

  const lists = drag?.type === 'card' ? drag.previewLists : board?.lists ?? [];
  return { lists, drag };
}
