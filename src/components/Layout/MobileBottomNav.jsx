import { LayoutDashboard, Sun, Star, CalendarDays, PanelLeft } from 'lucide-react';
import './MobileBottomNav.css';

/**
 * Barra inferior do celular: as quatro telas do dia a dia + "Navegar", que abre a gaveta com
 * boards, spaces e pastas. Fica ativo quando um board ou space está aberto.
 */
export default function MobileBottomNav({ visible, activeView, onViewChange, onOpenBoards }) {
  if (!visible) return null;

  const items = [
    { id: 'dashboard', label: 'Início', icon: LayoutDashboard },
    { id: 'myday', label: 'Diário', icon: Sun },
    { id: 'important', label: 'Importante', icon: Star },
    { id: 'planned', label: 'Planejado', icon: CalendarDays },
    { id: 'nav', label: 'Navegar', icon: PanelLeft, opensDrawer: true },
  ];

  const isActive = (item) => (item.opensDrawer
    ? activeView === 'board' || activeView.startsWith('space-') || activeView === 'contacts'
    : activeView === item.id);

  return (
    <nav className="mobile-bottom-nav" aria-label="Navegação principal">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(item);
        return (
          <button
            key={item.id}
            type="button"
            className={`mobile-bottom-nav__item ${active ? 'is-active' : ''}`}
            onClick={() => (item.opensDrawer ? onOpenBoards?.() : onViewChange(item.id))}
            aria-current={active && !item.opensDrawer ? 'page' : undefined}
            aria-haspopup={item.opensDrawer ? 'dialog' : undefined}
          >
            <span className="mobile-bottom-nav__pill">
              <Icon size={21} strokeWidth={active ? 2.3 : 1.8} aria-hidden />
            </span>
            <span className="mobile-bottom-nav__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
