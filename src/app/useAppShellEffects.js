/** Efeitos do shell: breakpoint desktop/mobile, zoom salvo e atalhos globais (Ctrl+K busca, Tab alterna sidebar). */
import { useEffect } from 'react';

export function useAppShellEffects(ctx) {
  const {
    setIsDesktop,
    setSidebarOpen,
    setShowSearch,
  } = ctx;

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setIsDesktop]);

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
  }, [setShowSearch, setSidebarOpen]);
}
