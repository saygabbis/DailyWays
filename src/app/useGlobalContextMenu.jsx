/** Menu de contexto global (clique direito fora de áreas com menu próprio): navegação, busca, sidebar, tela cheia. */
import { useCallback } from 'react';
import { LayoutDashboard, Sun, Star, CalendarDays, Search, Settings, PanelLeft, Maximize, Plus } from 'lucide-react';

export function useGlobalContextMenu(ctx) {
  const {
    activeView,
    setActiveView,
    sidebarOpen,
    setShowSettings,
    setShowSearch,
    showContextMenu,
    hideContextMenu,
    activeBoard,
    toggleSidebar,
  } = ctx;

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
  }, [activeView, activeBoard, sidebarOpen, toggleSidebar, showContextMenu, hideContextMenu, setActiveView, setShowSearch, setShowSettings]);

  return {
    handleGlobalContextMenu,
  };
}
