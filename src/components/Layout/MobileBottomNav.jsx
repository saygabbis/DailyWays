import { LayoutDashboard, Sun, LayoutGrid, CalendarDays } from 'lucide-react';
import './MobileBottomNav.css';

/**
 * Navegação inferior dedicada ao mobile (referência: Trello mobile).
 * Não renderiza em desktop — o pai controla com `visible`.
 */
export default function MobileBottomNav({
  visible,
  activeView,
  onViewChange,
  onOpenBoards,
  hasBoardContext,
}) {
  if (!visible) return null;

  const items = [
    { id: 'dashboard', label: 'Início', icon: LayoutDashboard, view: 'dashboard' },
    { id: 'myday', label: 'Diário', icon: Sun, view: 'myday' },
    { id: 'boards', label: 'Boards', icon: LayoutGrid, isBoards: true },
    { id: 'planned', label: 'Planejado', icon: CalendarDays, view: 'planned' },
  ];

  const isActive = (item) => {
    if (item.isBoards) {
      return activeView === 'board' || activeView.startsWith('space-');
    }
    return activeView === item.view;
  };

  const handleClick = (item) => {
    if (item.isBoards) {
      // Abre a sidebar para trocar de board; se houver board ativo mas a view não é board, navega primeiro.
      if (hasBoardContext && activeView !== 'board' && !activeView.startsWith('space-')) {
        onViewChange('board');
      }
      onOpenBoards?.();
      return;
    }
    onViewChange(item.view);
  };

  return (
    <nav className="mobile-bottom-nav" aria-label="Navegação principal">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(item);
        return (
          <button
            key={item.id}
            type="button"
            className={`mobile-bottom-nav__item ${active ? 'mobile-bottom-nav__item--active' : ''}`}
            onClick={() => handleClick(item)}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={22} strokeWidth={active ? 2.25 : 1.75} className="mobile-bottom-nav__icon" />
            <span className="mobile-bottom-nav__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
