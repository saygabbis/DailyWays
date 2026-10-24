/** Navegação do app: restaura a última tela após F5/login e persiste view/board ativo. */
import { useState, useEffect, useRef } from 'react';
import {
  persistNavigation,
  resolveRestoredNavigation,
  isWorkspaceDataReady,
} from '../utils/restoreNavigation';
import { useContextMenu } from '../components/Common/ContextMenu';

export function useWorkspaceNavigation(ctx) {
  const {
    user,
    dispatch,
    state,
    boardsLoadError,
    activeView,
    setActiveView,
    viewRestoreDoneRef,
    navPersistReadyRef,
    setNavReady,
  } = ctx;

  useEffect(() => {
    if (!navPersistReadyRef.current) return;
    persistNavigation(activeView, state.activeBoard);
  }, [activeView, state.activeBoard]);

  useEffect(() => {
    if (!user?.id) {
      viewRestoreDoneRef.current = false;
      navPersistReadyRef.current = false;
      setNavReady(false);
    }
  }, [user?.id]);

  // After F5 / open: restore last screen (board, space, dashboard, myday, …)
  useEffect(() => {
    if (!user?.id || viewRestoreDoneRef.current) return;
    if (!isWorkspaceDataReady({
      userId: user.id,
      boards: state.boards,
      boardsLoadError,
    })) {
      return;
    }

    const { view, boardId } = resolveRestoredNavigation({
      boards: state.boards,
      spaces: state.spaces,
      activeBoardHint: state.activeBoard,
    });

    if (boardId && state.activeBoard !== boardId) {
      dispatch({ type: 'SET_ACTIVE_BOARD', payload: boardId });
    }
    setActiveView(view);
    persistNavigation(view, boardId || state.activeBoard);
    viewRestoreDoneRef.current = true;
    navPersistReadyRef.current = true;
    setNavReady(true);
  }, [
    user?.id,
    state.boards,
    state.spaces,
    state.activeBoard,
    boardsLoadError,
    dispatch,
  ]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState('account');
  const [showSearch, setShowSearch] = useState(false);
  const { showContextMenu, hideContextMenu } = useContextMenu();
  const boardViewRef = useRef(null);
  const [plannedDropCard, setPlannedDropCard] = useState(null);

  return {
    selectedCard,
    setSelectedCard,
    showSettings,
    setShowSettings,
    settingsInitialTab,
    setSettingsInitialTab,
    showSearch,
    setShowSearch,
    showContextMenu,
    hideContextMenu,
    boardViewRef,
    plannedDropCard,
    setPlannedDropCard,
  };
}
