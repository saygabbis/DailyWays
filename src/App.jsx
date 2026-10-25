import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import ErrorBoundary from './components/Common/ErrorBoundary';
import { useAuth } from './context/useAuth';
import { useApp } from './context/useApp';
import { useTheme } from './context/useTheme';
import Sidebar from './components/Sidebar/Sidebar';
import Header from './components/Layout/Header';
import MobileBottomNav from './components/Layout/MobileBottomNav';
import BoardView from './components/Board/BoardView';
import BoardCollabBridge from './collab/board/sync/BoardCollabBridge.jsx';
import BoardCollabSync from './collab/board/sync/BoardCollabSync.jsx';
import { isCollabEnabled } from './collab/core/collabConfig.js';
import { pushPresenceFields } from './collab/board/presence/presenceBridge.js';
import { setLastBoardPointer } from './collab/board/presence/lastBoardPointer.js';
import { pointerCoordsFromBoardEvent } from './collab/board/coords/boardCursorCoords.js';
import { BoardCollabProvider } from './collab/board/ops/BoardCollabContext.jsx';
import { useBoardCollabDispatch } from './collab/board/ops/useBoardCollab';
import { persistNavigation } from './utils/restoreNavigation';

import PomodoroTimer from './components/Pomodoro/PomodoroTimer';
import RadioWidget from './components/Radio/RadioWidget';
import AppBottomFabCluster from './components/Help/AppBottomFabCluster';
import { useGlobalBoardUndoShortcuts } from './hooks/useGlobalBoardUndoShortcuts';
import BoardPrankSiteLock from './collab/board/dev/BoardPrankSiteLock.jsx';
import DevConfigSync from './dev/DevConfigSync.jsx';
import DevConfigHotkey from './dev/DevConfigHotkey.jsx';
import { setDevPrankSession } from './collab/board/dev/boardDevPrank.js';
import PlannedDropPopover from './components/Common/PlannedDropPopover';
import DndProvider from './dnd/DndProvider.jsx';
import { useWorkspaceNavigation } from './app/useWorkspaceNavigation';
import { useGlobalDragHandlers } from './app/useGlobalDragHandlers';
import { useAppShellEffects } from './app/useAppShellEffects';
import { useGlobalContextMenu } from './app/useGlobalContextMenu';
import { usePasswordResetGate } from './app/passwordResetGate';
import { getViewTitle, getViewSubtitle } from './app/viewTitles';
import './styles/global.css';
import './App.css';

// Telas carregadas sob demanda (code-splitting): o bundle inicial fica só com o shell + board.
const AuthPage = lazy(() => import('./components/Auth/AuthPage'));
const MyDayView = lazy(() => import('./components/MyDay/MyDayView'));
const ImportantView = lazy(() => import('./components/SmartViews/ImportantView'));
const PlannedView = lazy(() => import('./components/SmartViews/PlannedView'));
const DashboardView = lazy(() => import('./components/Dashboard/DashboardView'));
const ContactsView = lazy(() => import('./components/Contacts/ContactsView'));
const TaskDetailModal = lazy(() => import('./components/TaskDetail/TaskDetailModal'));
const SettingsModal = lazy(() => import('./components/Settings/SettingsView'));
const SearchOverlay = lazy(() => import('./components/Search/SearchOverlay'));
const SpaceView = lazy(() => import('./components/Spaces/SpaceView'));
const PasswordResetPage = lazy(() => import('./components/Auth/PasswordResetPage'));


function AppContent() {
  const { user, profile } = useAuth();

  useEffect(() => {
    setDevPrankSession(user, profile);
  }, [user, profile]);
  const {
    getActiveBoard,
    dispatch,
    state,
    boardsLoadError,
    profileMenuOpen,
    saveAllPending,
  } = useApp();
  const { collabDispatch, updateBoardMeta } = useBoardCollabDispatch();
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

  const {
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
    plannedDropCard,
    setPlannedDropCard,
  } = useWorkspaceNavigation({
    user,
    dispatch,
    state,
    boardsLoadError,
    activeView,
    setActiveView,
    viewRestoreDoneRef,
    navPersistReadyRef,
    setNavReady,
  });

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

  const { handlePlannedDateSelect } = useGlobalDragHandlers({
    collabDispatch,
    plannedDropCard,
    setPlannedDropCard,
  });

  // Pegar algo para arrastar fecha o menu de contexto aberto.
  useEffect(() => {
    window.addEventListener('dw-drag-start', hideContextMenu);
    return () => window.removeEventListener('dw-drag-start', hideContextMenu);
  }, [hideContextMenu]);

  useAppShellEffects({
    setIsDesktop,
    setSidebarOpen,
    setShowSearch,
  });

  const activeBoard = getActiveBoard();

  // No Space o Ctrl+Z é do canvas: antes os dois disparavam e desfaziam também o board aberto na sidebar.
  useGlobalBoardUndoShortcuts({ enabled: !selectedCard && activeView !== 'space' });

  const handleCardClick = (card, boardId, listId) => {
    setSelectedCard({ card, boardId, listId });
  };

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };

  // Handle view change — intercept "settings" to open modal instead
  const handleViewChange = useCallback(async (view, boardIdOverride = null) => {
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
  }, [activeView, saveAllPending, state.activeBoard, setShowSettings]);

  useEffect(() => {
    const onNavigate = (e) => {
      const view = e.detail?.view;
      if (view) handleViewChange(view);
    };
    window.addEventListener('app-navigate-view', onNavigate);
    return () => window.removeEventListener('app-navigate-view', onNavigate);
  }, [handleViewChange]);

  const getTitle = () => getViewTitle(activeView, activeBoard, state.spaces);
  const getSubtitle = () => getViewSubtitle(activeView, activeBoard);

  const mainClass = `app-main${sidebarOpen && isDesktop ? ' sidebar-pushed' : ''}${!isDesktop ? ' has-mobile-nav' : ''}`;

  const {
    handleGlobalContextMenu,
  } = useGlobalContextMenu({
    activeView,
    setActiveView,
    sidebarOpen,
    setShowSettings,
    setShowSearch,
    showContextMenu,
    hideContextMenu,
    activeBoard,
    toggleSidebar,
  });

  return (
    <DndProvider>
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
          onOpenSearch={() => setShowSearch(true)}
          onPlannedDrop={setPlannedDropCard}
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
            <ErrorBoundary label="view" resetKey={`${activeView}:${activeBoard?.id ?? ''}`}>
            <Suspense fallback={<div className="app-view-loading" aria-busy="true" />}>
            {navReady && activeView === 'dashboard' && <DashboardView key="dashboard" onCardClick={handleCardClick} />}
            {navReady && activeView === 'myday' && <MyDayView key="myday" onCardClick={handleCardClick} />}
            {navReady && activeView === 'important' && <ImportantView key="important" onCardClick={handleCardClick} />}
            {navReady && activeView === 'planned' && <PlannedView key="planned" onCardClick={handleCardClick} />}
            {navReady && activeView === 'contacts' && <ContactsView key="contacts" />}
            {navReady && activeView === 'board' && activeBoard && (
              <BoardView
                key={`board-${activeBoard.id}`}

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
            </Suspense>
            </ErrorBoundary>
          </div>
        </main>

        {/* Settings floating modal */}
        {showSettings && (
          <Suspense fallback={null}>
          <SettingsModal
            onClose={() => setShowSettings(false)}
            initialTab={settingsInitialTab}
          />
          </Suspense>
        )}

        {/* Search floating modal */}
        {showSearch && (
          <Suspense fallback={null}>
            <SearchOverlay onClose={() => setShowSearch(false)} onCardClick={handleCardClick} />
          </Suspense>
        )}

        {/* Pomodoro Focus Timer */}
        <PomodoroTimer />

        {/* Radio Widget */}
        <RadioWidget />

        {/* Chat e ajuda: painéis abertos pelo header/sidebar (sem botões flutuantes) */}
        {user && <AppBottomFabCluster onNavigateView={handleViewChange} />}

        {!isDesktop && (
          <MobileBottomNav
            visible
            activeView={activeView}
            onViewChange={handleViewChange}
            onOpenBoards={() => setSidebarOpen(true)}
          />
        )}

        {/* Task detail floating modal */}
        {selectedCard && (
          <Suspense fallback={null}>
          <TaskDetailModal
            key={selectedCard.card.id}
            card={selectedCard.card}
            boardId={selectedCard.boardId}
            listId={selectedCard.listId}
            onClose={() => setSelectedCard(null)}
          />
          </Suspense>
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
    </DndProvider>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  const shouldForcePasswordReset = usePasswordResetGate();

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner" />
      </div>
    );
  }

  // Segurança: na recuperação de senha, não mostrar o app principal.
  // Forçamos uma página dedicada para digitar a nova senha.
  if (shouldForcePasswordReset) return <Suspense fallback={null}><PasswordResetPage /></Suspense>;

  if (!user) return <Suspense fallback={null}><AuthPage /></Suspense>;

  return (
    <BoardCollabProvider>
      <AppContent />
    </BoardCollabProvider>
  );
}
