/** DragDropContext global: drops na sidebar (Meu Dia/Importante/Planejado, reordenar boards/spaces) e delega o resto ao BoardView. */
import { useCallback } from 'react';
import { pushPresenceFields } from '../collab/board/presence/presenceBridge.js';
import { publishBoardPresenceFull } from '../collab/board/presence/boardPresencePublish.js';
import { useBoardSelectionStore } from '../stores/boardSelectionStore';
import { isCardImportant } from '../utils/cardImportant';

export function useGlobalDragHandlers(ctx) {
  const {
    user,
    profile,
    getActiveBoard,
    dispatch,
    state,
    updateWorkspaceOrder,
    collabDispatch,
    collab,
    hideContextMenu,
    boardViewRef,
    plannedDropCard,
    setPlannedDropCard,
  } = ctx;

  // Global DragDropContext handler — intercepts sidebar drops, delegates the rest
  const handleGlobalDragStart = useCallback((start) => {
    hideContextMenu();
    document.body.classList.add('dnd-dragging');
    const boardId = getActiveBoard()?.id;
    if (boardId && start.type === 'list') {
      pushPresenceFields(boardId, {
        draggingListId: start.draggableId,
        draggingCardId: null,
        selectedCardId: null,
        onBoardSurface: true,
      });
    } else if (
      boardId
      && start.type !== 'list'
      && start.source?.droppableId
      && start.source.droppableId !== 'board'
      && start.source.droppableId !== 'boards'
    ) {
      useBoardSelectionStore.getState().beginMultiDrag(start.draggableId);
      if (useBoardSelectionStore.getState().multiDragCardIds.length > 1) {
        document.body.classList.add('board-multi-drag-active');
      }
      pushPresenceFields(boardId, {
        draggingCardId: start.draggableId,
        draggingListId: start.source.droppableId,
        selectedCardId: null,
        onBoardSurface: true,
      });
    }
    if (boardId && collab?.socket?.connected) {
      publishBoardPresenceFull(collab.socket, boardId, { user, profile });
    }
    if (['board', 'space', 'board-group', 'space-group'].includes(start.type)) {
      if (state.selectedItems?.includes(start.draggableId) && state.selectedItems.length > 1) {
        dispatch({ type: 'SET_DRAGGING_BULK', payload: true });
      }
    }
  }, [state.selectedItems, dispatch, hideContextMenu, getActiveBoard, collab?.socket, user, profile]);

  const handleGlobalDragEnd = useCallback((result) => {
    document.body.classList.remove('dnd-dragging');
    try {
    const boardId = getActiveBoard()?.id;
    if (boardId) {
      pushPresenceFields(boardId, { draggingCardId: null, draggingListId: null });
      if (collab?.socket?.connected) {
        publishBoardPresenceFull(collab.socket, boardId, { user, profile });
      }
    }
    dispatch({ type: 'SET_DRAGGING_BULK', payload: false });
    const { source, destination, draggableId, type } = result;
    if (!destination) return;

    // Sidebar smart drop zones
    if (destination.droppableId.startsWith('sidebar-')) {
      // Find the card across all boards
      let card = null, boardId = null, listId = null;
      for (const b of state.boards) {
        for (const l of b.lists) {
          const found = l.cards.find(c => c.id === draggableId);
          if (found) {
            card = found;
            boardId = b.id;
            listId = l.id;
            break;
          }
        }
        if (card) break;
      }
      if (!card) return;

      if (destination.droppableId === 'sidebar-myday') {
        collabDispatch({
          type: 'UPDATE_CARD',
          payload: { boardId, listId, cardId: card.id, updates: { myDay: true } },
        });
      } else if (destination.droppableId === 'sidebar-important') {
        // "Importante" = prioridade alta/urgente (não existe coluna `important`: antes sumia no F5).
        if (!isCardImportant(card)) {
          collabDispatch({
            type: 'UPDATE_CARD',
            payload: { boardId, listId, cardId: card.id, updates: { priority: 'high' } },
          });
        }
      } else if (destination.droppableId === 'sidebar-planned') {
        setPlannedDropCard({ card, boardId, listId });
      }
      return;
    }

    // Workspace Reordering in Sidebar (Groups, Boards, Spaces)
    if (['board', 'space', 'group', 'board-group', 'space-group'].includes(type) && destination.droppableId !== 'boards') {
      // old 'boards' droppableId is replaced by 'boards-root', 'spaces-root', 'groups-board', 'groups-space', and 'group-{id}'
      if (source.droppableId === destination.droppableId && source.index === destination.index) return;

      let itemType = 'boards';
      if (type === 'space') itemType = 'spaces';
      if (type === 'group' || type === 'board-group' || type === 'space-group') itemType = 'groups';

      let sourceGroupId = null;
      if (source.droppableId.startsWith('group-') && source.droppableId !== 'groups-board' && source.droppableId !== 'groups-space') {
        sourceGroupId = source.droppableId.replace('group-', '');
      }

      let destGroupId = null;
      if (destination.droppableId.startsWith('group-') && destination.droppableId !== 'groups-board' && destination.droppableId !== 'groups-space') {
        destGroupId = destination.droppableId.replace('group-', '');
      }

      // Call updateWorkspaceOrder from the App Context
      updateWorkspaceOrder(itemType, draggableId, sourceGroupId, destGroupId, destination.index);

      return;
    }

    // Board card / list DnD — delegate to BoardView
    if (boardViewRef.current?.handleDragEnd) {
      boardViewRef.current.handleDragEnd(result);
    }
    } finally {
      document.body.classList.remove('board-multi-drag-active');
      useBoardSelectionStore.getState().clearMultiDrag();
    }
  }, [getActiveBoard, dispatch, boardViewRef, collab?.socket, user, profile, state.boards, collabDispatch, setPlannedDropCard, updateWorkspaceOrder]);

  const handlePlannedDateSelect = (date) => {
    if (!plannedDropCard) return;
    const { boardId, listId, card } = plannedDropCard;
    collabDispatch({
      type: 'UPDATE_CARD',
      payload: { boardId, listId, cardId: card.id, updates: { dueDate: date } },
    });
    setPlannedDropCard(null);
  };

  return {
    handleGlobalDragStart,
    handleGlobalDragEnd,
    handlePlannedDateSelect,
  };
}
