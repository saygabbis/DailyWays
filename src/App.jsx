import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './context/AuthContext';
import { useApp } from './context/AppContext';
import { useTheme } from './context/ThemeContext';
import AuthPage from './components/Auth/AuthPage';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import MobileBottomNav from './components/Layout/MobileBottomNav';
import BoardView from './components/Board/BoardView';
import MyDayView from './components/MyDay/MyDayView';
import ImportantView from './components/SmartViews/ImportantView';
import PlannedView from './components/SmartViews/PlannedView';
import DashboardView from './components/Dashboard/DashboardView';
import ContactsView from './components/Contacts/ContactsView';
import TaskDetailModal from './components/TaskDetail/TaskDetailModal';
import SettingsModal from './components/Settings/SettingsView';
import SearchOverlay from './components/Search/SearchOverlay';
import SpaceView from './components/Spaces/SpaceView';
import BoardCollabBridge from './collab/board/sync/BoardCollabBridge.jsx';
import BoardCollabSync from './collab/board/sync/BoardCollabSync.jsx';
import { isCollabEnabled } from './collab/core/collabConfig.js';
import { pushPresenceFields } from './collab/board/presence/presenceBridge.js';
import { publishBoardPresenceFull } from './collab/board/presence/boardPresencePublish.js';
import { useCollab } from './collab/core/CollabContext.jsx';
import { setLastBoardPointer } from './collab/board/presence/lastBoardPointer.js';
import { pointerCoordsFromBoardEvent } from './collab/board/coords/boardCursorCoords.js';
import { BoardCollabProvider, useBoardCollabDispatch } from './collab/board/ops/BoardCollabContext.jsx';
import PasswordResetPage from './components/Auth/PasswordResetPage';
import {
  persistNavigation,
  resolveRestoredNavigation,
  isWorkspaceDataReady,
} from './utils/restoreNavigation';

import PomodoroTimer from './components/Pomodoro/PomodoroTimer';
import RadioWidget from './components/Radio/RadioWidget';
import AppBottomFabCluster from './components/Help/AppBottomFabCluster';
import { useGlobalBoardUndoShortcuts } from './hooks/useGlobalBoardUndoShortcuts';
import BoardPrankSiteLock from './collab/board/dev/BoardPrankSiteLock.jsx';
import DevConfigSync from './dev/DevConfigSync.jsx';
import DevConfigHotkey from './dev/DevConfigHotkey.jsx';
import { setDevPrankSession } from './collab/board/dev/boardDevPrank.js';
import PlannedDropPopover from './components/Common/PlannedDropPopover';
import { useContextMenu } from './components/Common/ContextMenu';
import { DragDropContext } from '@hello-pangea/dnd';
import { useBoardSelectionStore } from './stores/boardSelectionStore';
import { LayoutDashboard, Sun, Star, CalendarDays, Search, Settings, PanelLeft, Maximize, Plus } from 'lucide-react';
import './styles/global.css';
import './App.css';

function AppContent() {
  const { user, profile } = useAuth();

  useEffect(() => {
    setDevPrankSession(user, profile);
  }, [user, profile]);
  const {
    getActiveBoard,
    confirmConfig,
    dispatch,
    getAllCards,
    state,
    updateBoardsOrder,
    suppressRealtime,
    updateWorkspaceOrder,
    boardsLoadError,
    profileMenuOpen,
    saveAllPending,
  } = useApp();
  const { collabDispatch, updateBoardMeta } = useBoardCollabDispatch();
  const collab = useCollab();
  const { initPreferences } = useTheme();
  const [activeView, setActiveView] = useState('dashboard');
  const viewRestoreDoneRef = useRef(false);
  const navPersistReadyRef = useRef(false);
  const [navReady, setNavReady] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 768);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);

  // Sync DB preferences (theme, font, accent, language, anim) to ThemeContext on login
  useEffect(() => {
    if (user?.id && profile) {
      initPreferences(user.id, profile);
    } else if (!user) {
      initPreferences(null, null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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

  const activeBoardId = getActiveBoard()?.id;
  /** Só mantém sala collab na vista do board; ao ir para Diário/Visão geral/etc. faz leave. */
  const keepBoardCollabSession =
    activeView === 'board'
    && !!activeBoardId
    && isCollabEnabled();

  useEffect(() => {
    const onPointerMove = (e) => {
      if (!document.body.classList.contains('dnd-dragging') || !activeBoardId) return;
      const scroller = document.querySelector('.board-scroller');
      if (!scroller) return;
      const coords = pointerCoordsFromBoardEvent(e, scroller);
      const partial = {
        ...coords,
        onBoardSurface: true,
      };
      setLastBoardPointer(activeBoardId, {
        x: coords.x,
        y: coords.y,
        cursorScreen: coords.cursorScreen,
      });
      pushPresenceFields(activeBoardId, partial);
    };
    document.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => document.removeEventListener('pointermove', onPointerMove);
  }, [activeBoardId]);

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
  }, [state.selectedItems, dispatch, hideContextMenu, getActiveBoard, collab?.socket, collab?.connected, user, profile]);

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
        collabDispatch({
          type: 'UPDATE_CARD',
          payload: { boardId, listId, cardId: card.id, updates: { important: true } },
        });
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
  }, [state.boards, collabDispatch, user?.id, profile, collab?.socket, collab?.connected, getActiveBoard, updateBoardsOrder, suppressRealtime]);

  const handlePlannedDateSelect = (date) => {
    if (!plannedDropCard) return;
    const { boardId, listId, card } = plannedDropCard;
    collabDispatch({
      type: 'UPDATE_CARD',
      payload: { boardId, listId, cardId: card.id, updates: { dueDate: date } },
    });
    setPlannedDropCard(null);
  };

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Apply stored zoom on mount
  useEffect(() => {
    const zoom = localStorage.getItem('dailyways_zoom');
    if (zoom) document.documentElement.style.fontSize = `${zoom}%`;

    // Keyboard shortcuts
    const handleKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
      // Tab to toggle sidebar (only when not in an input)
      if (e.key === 'Tab' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tag = document.activeElement?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !document.activeElement?.isContentEditable) {
          e.preventDefault();
          setSidebarOpen(prev => !prev);
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const activeBoard = getActiveBoard();

  useGlobalBoardUndoShortcuts({ enabled: !selectedCard });

  const handleCardClick = (card, boardId, listId) => {
    setSelectedCard({ card, boardId, listId });
  };

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };

  // Handle view change — intercept "settings" to open modal instead
  const handleViewChange = async (view, boardIdOverride = null) => {
    if (view === 'settings') {
      setShowSettings(true);
      return;
    }
    if (activeView === 'important' || activeView === 'planned' || activeView === 'myday') {
      await saveAllPending();
    }
    viewRestoreDoneRef.current = true;
    navPersistReadyRef.current = true;
    setNavReady(true);
    setActiveView(view);
    const boardId = view === 'board' ? (boardIdOverride || state.activeBoard) : state.activeBoard;
    persistNavigation(view, boardId);
  };

  useEffect(() => {
    const onNavigate = (e) => {
      const view = e.detail?.view;
      if (view) handleViewChange(view);
    };
    window.addEventListener('app-navigate-view', onNavigate);
    return () => window.removeEventListener('app-navigate-view', onNavigate);
  }, [handleViewChange]);

  const getTitle = () => {
    switch (activeView) {
      case 'dashboard': return 'Visão Geral';
      case 'myday': return 'Diário';
      case 'important': return 'Importante';
      case 'planned': return 'Planejado';
      case 'contacts': return 'Contatos';
      case 'board': return activeBoard ? `${activeBoard.emoji} ${activeBoard.title}` : 'Board';
      case 'help': return 'Central de Ajuda';
      default:
        if (activeView.startsWith('space-')) {
          const spaceId = activeView.replace('space-', '');
          const space = state.spaces.find(s => s.id === spaceId);
          return space ? `${space.emoji} ${space.title}` : 'Space';
        }
        return 'DailyWays';
    }
  };

  const getSubtitle = () => {
    if (activeView === 'board' && activeBoard) {
      const totalCards = activeBoard.lists.reduce((acc, l) => acc + l.cards.length, 0);
      return `${activeBoard.lists.length} listas · ${totalCards} tarefas`;
    }
    if (activeView.startsWith('space-')) {
      return 'Canvas Infinito';
    }
    return null;
  };

  const mainClass = `app-main${sidebarOpen && isDesktop ? ' sidebar-pushed' : ''}${!isDesktop ? ' has-mobile-nav' : ''}`;

  // Global right-click context menu
  const handleGlobalContextMenu = useCallback((e) => {
    // Don't override if a child already handled it (stopPropagation)
    if (e.defaultPrevented) return;

    // Don't show on inputs, buttons, etc.
    const target = e.target;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'BUTTON' ||
      target.closest('button') ||
      target.tagName === 'A' ||
      target.closest('a') ||
      target.isContentEditable
    ) {
      e.preventDefault();
      hideContextMenu();
      return;
    }

    const navItems = [
      { label: 'Visão Geral', icon: <LayoutDashboard size={15} />, action: () => setActiveView('dashboard'), shortcut: '' },
      { label: 'Diário', icon: <Sun size={15} />, action: () => setActiveView('myday') },
      { label: 'Importante', icon: <Star size={15} />, action: () => setActiveView('important') },
      { label: 'Planejado', icon: <CalendarDays size={15} />, action: () => setActiveView('planned') },
    ];

    const boardItems = activeView === 'board' && activeBoard ? [
      { type: 'divider' },
      {
        label: 'Adicionar lista', icon: <Plus size={15} />, action: () => {
          // Dispatch to trigger add list form in BoardView — simplified: we just focus the "add list" button
          const addBtn = document.querySelector('.board-add-list-btn');
          if (addBtn) addBtn.click();
        }
      },
    ] : [];

    const generalItems = [
      { type: 'divider' },
      { label: 'Buscar', icon: <Search size={15} />, action: () => setShowSearch(true), shortcut: 'Ctrl+K' },
      { label: sidebarOpen ? 'Fechar sidebar' : 'Abrir sidebar', icon: <PanelLeft size={15} />, action: toggleSidebar },
      { label: 'Configurações', icon: <Settings size={15} />, action: () => setShowSettings(true) },
      { type: 'divider' },
      {
        label: 'Tela cheia', icon: <Maximize size={15} />, action: () => {
          if (document.fullscreenElement) document.exitFullscreen();
          else document.documentElement.requestFullscreen();
        }
      },
    ];

    showContextMenu(e, [...navItems, ...boardItems, ...generalItems], { title: 'DailyWays' });
  }, [activeView, activeBoard, sidebarOpen, showContextMenu, toggleSidebar]);

  return (
    <DragDropContext onDragStart={handleGlobalDragStart} onDragEnd={handleGlobalDragEnd}>
      <BoardCollabBridge />
      {navReady && keepBoardCollabSession && (
        <BoardCollabSync
          boardId={activeBoardId}
          boardViewActive={activeView === 'board'}
        />
      )}
      <div className="app-layout" onContextMenu={handleGlobalContextMenu}>
        <Sidebar
          activeView={activeView}
          onViewChange={handleViewChange}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isDesktop={isDesktop}
        />

        <main className={mainClass}>
          <Header
            title={getTitle()}
            subtitle={getSubtitle()}
            variant={activeView === 'board' || activeView.startsWith('space-') ? 'workspace' : 'default'}
            onMenuClick={toggleSidebar}
            sidebarOpen={sidebarOpen}
            onOpenSettings={(tab) => {
              setSettingsInitialTab(tab || 'account');
              setShowSettings(true);
            }}
            onOpenSearch={() => setShowSearch(true)}
            onOpenDiary={() => handleViewChange('myday')}
            editableBoardTitle={activeView === 'board' && activeBoard ? { board: activeBoard, onSave: (newTitle) => updateBoardMeta({ title: newTitle }) } : null}
            editableSpaceTitle={activeView.startsWith('space-') && (() => {
              const spaceId = activeView.replace('space-', '');
              const space = state.spaces.find(s => s.id === spaceId);
              return space ? { space, onSave: async (newTitle) => {
                dispatch({ type: 'UPDATE_SPACE', payload: { id: spaceId, updates: { title: newTitle } } });
                const { updateSpace } = await import('./services/workspaceService');
                await updateSpace(spaceId, { title: newTitle });
              } } : null;
            })()}
          />

          {boardsLoadError && user && (
            <div className="boards-load-error-banner" role="alert">
              <span className="boards-load-error-text">{boardsLoadError}</span>
              <div className="boards-load-error-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: 'SET_BOARDS_LOAD_ERROR', payload: null })}>
                  Fechar
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>
                  Recarregar
                </button>
              </div>
            </div>
          )}

          <div className="app-content" onClick={() => {
            if (state.selectedItems?.length > 0 && !state.isDraggingBulk) dispatch({ type: 'CLEAR_SELECTION' });
          }}>
            {navReady && activeView === 'dashboard' && <DashboardView key="dashboard" />}
            {navReady && activeView === 'myday' && <MyDayView key="myday" onCardClick={handleCardClick} />}
            {navReady && activeView === 'important' && <ImportantView key="important" onCardClick={handleCardClick} />}
            {navReady && activeView === 'planned' && <PlannedView key="planned" onCardClick={handleCardClick} />}
            {navReady && activeView === 'contacts' && <ContactsView key="contacts" />}
            {navReady && activeView === 'board' && activeBoard && (
              <BoardView
                key={`board-${activeBoard.id}`}
                ref={boardViewRef}
                onCardClick={handleCardClick}
                focusedCardId={
                  selectedCard?.boardId === activeBoard.id ? selectedCard.card.id : null
                }
                boardAwayOverlay={
                  showSettings
                  || showSearch
                  || profileMenuOpen
                  || !!plannedDropCard
                }
              />
            )}
            {navReady && activeView.startsWith('space-') && (() => {
              const spaceId = activeView.replace('space-', '');
              return <SpaceView key={`space-${spaceId}`} spaceId={spaceId} />;
            })()}
            {activeView === 'help' && (
              <div className="help-view-placeholder">
                <h2>Central de ajuda</h2>
                <p>Use o botão <strong>?</strong> no canto inferior direito em qualquer tela.</p>
                <button type="button" className="btn btn-primary" onClick={() => window.dispatchEvent(new CustomEvent('app-help-open'))}>
                  Abrir agora
                </button>
              </div>
            )}
          </div>
        </main>

        {/* Settings floating modal */}
        {showSettings && (
          <SettingsModal
            onClose={() => setShowSettings(false)}
            initialTab={settingsInitialTab}
          />
        )}

        {/* Search floating modal */}
        {showSearch && <SearchOverlay onClose={() => setShowSearch(false)} onCardClick={handleCardClick} />}

        {/* Pomodoro Focus Timer */}
        <PomodoroTimer />

        {/* Radio Widget */}
        <RadioWidget />

        {/* Undo/redo + ajuda (?) */}
        {user && (
          <AppBottomFabCluster
            boardId={activeBoard?.id}
            showBoardHistory={activeView === 'board' && !!activeBoard}
            onNavigateView={handleViewChange}
          />
        )}

        {!isDesktop && (
          <MobileBottomNav
            visible
            activeView={activeView}
            onViewChange={handleViewChange}
            onOpenBoards={() => setSidebarOpen(true)}
            hasBoardContext={!!activeBoard}
          />
        )}

        {/* Task detail floating modal */}
        {selectedCard && (
          <TaskDetailModal
            card={selectedCard.card}
            boardId={selectedCard.boardId}
            listId={selectedCard.listId}
            onClose={() => setSelectedCard(null)}
          />
        )}


        {/* Planned drop date popover */}
        {plannedDropCard && (
          <PlannedDropPopover
            cardTitle={plannedDropCard.card.title}
            onSelectDate={handlePlannedDateSelect}
            onClose={() => setPlannedDropCard(null)}
          />
        )}

        <BoardPrankSiteLock />
        <DevConfigSync />
        <DevConfigHotkey />

      </div>
    </DragDropContext>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  const hash = window.location.hash || '';
  const search = window.location.search || '';
  const combined = `${hash || ''}&${search || ''}`.toLowerCase();

  const isPasswordRecovery = (() => {
    // usa as mesmas variáveis externas (hash/search) porém mantendo o escopo local
    const combined = `${hash || ''}&${search || ''}`.toLowerCase();

    const searchParams = new URLSearchParams(search || '');
    const hashParams = new URLSearchParams(hash?.startsWith('#') ? hash.slice(1) : hash || '');

    const type = (searchParams.get('type') || hashParams.get('type') || '').toLowerCase();
    const token = searchParams.get('token') || hashParams.get('token');

    // Casos suportados:
    // 1) Supabase recovery link: ?type=recovery&token=...
    if (type === 'recovery' && token) return true;

    // 2) Links que vêm com access/refresh token (às vezes sem `token=...`)
    const hasAccessRefresh =
      (combined.includes('access_token') || combined.includes('access_token=')) &&
      (combined.includes('refresh_token') || combined.includes('refresh_token='));

    // Para evitar falso positivo em fluxos não relacionados,
    // exigimos que seja explicitamente recovery pelo `type` ou pela palavra "recovery".
    const hasRecoveryKeyword = type === 'recovery' || combined.includes('recovery');

    return hasAccessRefresh && hasRecoveryKeyword;
  })();

  const pwResetPending = window.localStorage.getItem('dailyways_pw_reset_pending') === '1';
  const pwResetPendingTs = Number(window.localStorage.getItem('dailyways_pw_reset_pending_ts') || '0');
  const pwResetPendingValid = pwResetPending && !!pwResetPendingTs && (Date.now() - pwResetPendingTs) < 10 * 60 * 1000;

  const urlHasAccessRefresh =
    (combined.includes('access_token') || combined.includes('access_token=')) &&
    (combined.includes('refresh_token') || combined.includes('refresh_token='));

  // Segurança + UX:
  // 1) Se a URL indicar explicitamente recovery, abre a tela.
  // 2) Se houver access/refresh tokens na URL e você iniciou recovery recentemente,
  // ainda abrimos (alguns redirects não vêm com `type=recovery`).
  // 3) Em navegação normal, sem tokens na URL, nunca força a tela novamente.
  const shouldForcePasswordReset = isPasswordRecovery || (pwResetPendingValid && urlHasAccessRefresh);

  // Limpa a flag pendente quando não for recovery real na URL (ou quando expirar),
  // pra não ficar "preso" e aparecer de novo em login normal.
  useEffect(() => {
    if (!pwResetPending) return;
    if (isPasswordRecovery) return;
    if (urlHasAccessRefresh) return;
    window.localStorage.removeItem('dailyways_pw_reset_pending');
    window.localStorage.removeItem('dailyways_pw_reset_pending_ts');
  }, [isPasswordRecovery, pwResetPending, pwResetPendingValid, urlHasAccessRefresh]);

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner" />
      </div>
    );
  }

  // Segurança: na recuperação de senha, não mostrar o app principal.
  // Forçamos uma página dedicada para digitar a nova senha.
  if (shouldForcePasswordReset) return <PasswordResetPage />;

  if (!user) return <AuthPage />;

  return (
    <BoardCollabProvider>
      <AppContent />
    </BoardCollabProvider>
  );
}
