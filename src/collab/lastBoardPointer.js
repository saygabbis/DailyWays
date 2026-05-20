const STORAGE_KEY = 'dailyways_last_board_pointer';

/** Persist last pointer per board (survives F5). */
export function setLastBoardPointer(boardId, { x, y, cursorScreen }) {
  if (!boardId || typeof x !== 'number' || typeof y !== 'number') return;
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        boardId,
        x,
        y,
        cursorScreen: cursorScreen || null,
        ts: Date.now(),
      }),
    );
  } catch {
    /* ignore quota */
  }
}

export function getLastBoardPointer(boardId) {
  if (!boardId) return null;
  try {
    const raw = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    if (!raw || raw.boardId !== boardId) return null;
    if (Date.now() - (raw.ts || 0) > 4 * 60 * 60 * 1000) return null;
    return raw;
  } catch {
    return null;
  }
}

/** Default cursor in board scroller space when no recent pointer. */
export function defaultBoardPointer(boardId) {
  const scroller = document.querySelector('.board-scroller');
  if (!scroller) return null;
  const rect = scroller.getBoundingClientRect();
  const x = Math.max(8, rect.width * 0.5 + scroller.scrollLeft);
  const y = Math.max(8, rect.height * 0.5 + scroller.scrollTop);
  return {
    x,
    y,
    cursorScreen: {
      x: rect.left + rect.width * 0.5,
      y: rect.top + rect.height * 0.5,
    },
  };
}

export function seedBoardCursorFields(boardId) {
  const last = getLastBoardPointer(boardId) || defaultBoardPointer(boardId);
  if (!last) return false;
  return last;
}
