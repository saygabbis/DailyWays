/** Chaves estáveis para hover colaborativo na superfície do board. */
export const BOARD_UI_HOVER = {
  addList: 'board-add-list',
  addCard: (listId) => `list-add-card:${listId}`,
};

export function boardUiHoverProps(hoverByUiKey, key, className = '') {
  const peer = hoverByUiKey?.[key]?.[0];
  if (!peer) return { className };
  return {
    className: [className, 'presence-remote-hover-target'].filter(Boolean).join(' '),
    style: { '--presence-color': peer.color },
  };
}
