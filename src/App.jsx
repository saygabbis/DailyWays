import { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { useApp } from './context/AppContext';
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
import './styles/global.css';
import './App.css';

function AppContent() {
  const { getActiveBoard } = useApp();
  const [activeView, setActiveView] = useState('myday');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 768);

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

  return (
    <div className="app-layout">
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
          {activeView === 'dashboard' && <DashboardView />}
          {activeView === 'myday' && <MyDayView onCardClick={handleCardClick} />}
          {activeView === 'important' && <ImportantView onCardClick={handleCardClick} />}
          {activeView === 'planned' && <PlannedView onCardClick={handleCardClick} />}
          {activeView === 'board' && <BoardView onCardClick={handleCardClick} />}
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
