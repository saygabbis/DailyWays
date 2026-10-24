import { createContext, useCallback, useContext } from 'react';
import { useApp } from '../../../context/useApp';

export const BoardCollabContext = createContext(null);

export function useBoardCollabContext() {
  return useContext(BoardCollabContext);
}

export function useBoardCollabDispatch(boardId) {
  const ctx = useBoardCollabContext();
  const { dispatch } = useApp();

  const resolvedBoardId = boardId ?? ctx?.activeBoardId;

  const collabDispatch = useCallback(
    (action, options) => {
      if (ctx && resolvedBoardId) {
        ctx.collabDispatchForBoard(resolvedBoardId, action, options);
      } else if (ctx) {
        ctx.collabDispatch(action, resolvedBoardId, options);
      } else {
        dispatch(action);
      }
    },
    [ctx, resolvedBoardId, dispatch],
  );

  const updateBoardMeta = useCallback(
    (updates) => {
      if (!resolvedBoardId) return;
      ctx?.collabDispatchForBoard(resolvedBoardId, {
        type: 'UPDATE_BOARD',
        payload: { id: resolvedBoardId, updates },
      });
    },
    [ctx, resolvedBoardId],
  );

  if (!ctx) {
    return {
      collabDispatch: dispatch,
      updateBoardMeta: () => {},
      connected: false,
      collabEnabled: false,
      isBoardRoomReady: () => true,
    };
  }

  return {
    collabDispatch,
    collabDispatchForBoard: ctx.collabDispatchForBoard,
    updateBoardMeta,
    connected: ctx.connected,
    collabEnabled: ctx.collabEnabled,
    activeBoardId: ctx.activeBoardId,
    isBoardRoomReady: ctx.isBoardRoomReady,
  };
}
