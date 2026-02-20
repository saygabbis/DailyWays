import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { useApp } from './context/AppContext';
import { useTheme } from './context/ThemeContext';
import AuthPage from './components/Auth/AuthPage';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import BoardView from './components/Board/BoardView';
import MyDayView from './components/MyDay/MyDayView';
import ImportantView from './components/SmartViews/ImportantView';
import PlannedView from './components/SmartViews/PlannedView';
import DashboardView from './components/Dashboard/DashboardView';
import TaskDetailModal from './components/TaskDetail/TaskDetailModal';
import SettingsModal from './components/Settings/SettingsView';
import SearchOverlay from './components/Search/SearchOverlay';

import PomodoroTimer from './components/Pomodoro/PomodoroTimer';
import FloatingSaveButton from './components/Common/FloatingSaveButton';
import { useContextMenu } from './components/Common/ContextMenu';
import { LayoutDashboard, Sun, Star, CalendarDays, Search, Settings, PanelLeft, Maximize, Plus } from 'lucide-react';
import './styles/global.css';
import './App.css';

function AppContent() {
  const { user, profile } = useAuth();
  const { getActiveBoard, confirmConfig } = useApp();
  const { initPreferences } = useTheme();
  const [activeView, setActiveView] = useState(() => localStorage.getItem('dailyways_active_view') || 'myday');
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

  // Persist view change
  useEffect(() => {
    localStorage.setItem('dailyways_active_view', activeView);
  }, [activeView]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const { showContextMenu } = useContextMenu();

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Apply stored zoom on mount
  useEffect(() => {
    const zoom = localStorage.getItem('dailyways_zoom');
    if (zoom) document.documentElement.style.fontSize = `${zoom}%`;

    // Keyboard shortcut for search
    const handleKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const activeBoard = getActiveBoard();

  const handleCardClick = (card, boardId, listId) => {
    setSelectedCard({ card, boardId, listId });
  };

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };

  // Handle view change — intercept "settings" to open modal instead
  const handleViewChange = (view) => {
    if (view === 'settings') {
      setShowSettings(true);
      return;
    }
    setActiveView(view);
  };

  const getTitle = () => {
    switch (activeView) {
      case 'dashboard': return 'Visão Geral';
      case 'myday': return 'Meu Dia';
      case 'important': return 'Importante';
      case 'planned': return 'Planejado';
      case 'board': return activeBoard ? `${activeBoard.emoji} ${activeBoard.title}` : 'Board';
      case 'help': return 'Central de Ajuda';
      default: return 'DailyWays';
    }
  };

  const getSubtitle = () => {
    if (activeView === 'board' && activeBoard) {
      const totalCards = activeBoard.lists.reduce((acc, l) => acc + l.cards.length, 0);
      return `${activeBoard.lists.length} listas · ${totalCards} tarefas`;
    }
    return null;
  };

  const mainClass = `app-main${sidebarOpen && isDesktop ? ' sidebar-pushed' : ''}`;

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
      { label: 'Meu Dia', icon: <Sun size={15} />, action: () => setActiveView('myday') },
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
          onMenuClick={toggleSidebar}
          sidebarOpen={sidebarOpen}
          onOpenSettings={() => setShowSettings(true)}
          onOpenSearch={() => setShowSearch(true)}
        />

        <div className="app-content">
          {activeView === 'dashboard' && <DashboardView key="dashboard" />}
          {activeView === 'myday' && <MyDayView key="myday" onCardClick={handleCardClick} />}
          {activeView === 'important' && <ImportantView key="important" onCardClick={handleCardClick} />}
          {activeView === 'planned' && <PlannedView key="planned" onCardClick={handleCardClick} />}
          {activeView === 'board' && activeBoard && <BoardView key={`board-${activeBoard.id}`} onCardClick={handleCardClick} />}
          {activeView === 'help' && (
            <div style={{ padding: 'var(--space-xl)', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '80px' }}>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🤝 Central de Ajuda</h2>
              <p>Em breve! Estamos preparando dicas e tutoriais para você.</p>
            </div>
          )}
        </div>
      </main>

      {/* Settings floating modal */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {/* Search floating modal */}
      {showSearch && <SearchOverlay onClose={() => setShowSearch(false)} onCardClick={handleCardClick} />}

      {/* Pomodoro Focus Timer */}
      <PomodoroTimer />

      {/* Floating save button — shown when there are unsaved local changes */}
      <FloatingSaveButton />

      {/* Task detail floating modal */}
      {selectedCard && (
        <TaskDetailModal
          card={selectedCard.card}
          boardId={selectedCard.boardId}
          listId={selectedCard.listId}
          onClose={() => setSelectedCard(null)}
        />
      )}


    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner" />
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return <AppContent />;
}
