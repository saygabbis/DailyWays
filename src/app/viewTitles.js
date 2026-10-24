/** Título/subtítulo do header para cada view do app (funções puras). */
const STATIC_TITLES = {
  dashboard: 'Visão Geral',
  myday: 'Diário',
  important: 'Importante',
  planned: 'Planejado',
  contacts: 'Contatos',
  help: 'Central de Ajuda',
};

export function getViewTitle(activeView, activeBoard, spaces = []) {
  if (STATIC_TITLES[activeView]) return STATIC_TITLES[activeView];
  if (activeView === 'board') return activeBoard ? `${activeBoard.emoji} ${activeBoard.title}` : 'Board';
  if (activeView?.startsWith('space-')) {
    const space = spaces.find((s) => s.id === activeView.slice('space-'.length));
    return space ? `${space.emoji} ${space.title}` : 'Space';
  }
  return 'DailyWays';
}

export function getViewSubtitle(activeView, activeBoard) {
  if (activeView === 'board' && activeBoard) {
    const totalCards = activeBoard.lists.reduce((acc, l) => acc + l.cards.length, 0);
    return `${activeBoard.lists.length} listas · ${totalCards} tarefas`;
  }
  if (activeView?.startsWith('space-')) return 'Canvas Infinito';
  return null;
}
