import { boardListsContentPointFromClient } from '../coords/scrollContentCoords.js';

const STORAGE_KEY = 'dailyways_last_board_pointers_v2';

function readMap() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function writeMap(map) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota */
  }
}

/** Persist last pointer per board (survives F5 e troca na sidebar). */
export function setLastBoardPointer(boardId, { x, y, cursorScreen }) {
  if (!boardId || typeof x !== 'number' || typeof y !== 'number') return;
  const map = readMap();
  map[boardId] = {
    x,
    y,
    cursorScreen: cursorScreen || null,
    ts: Date.now(),
  };
  writeMap(map);
}

export function getLastBoardPointer(boardId) {
  if (!boardId) return null;
  const entry = readMap()[boardId];
  if (!entry) return null;
  if (Date.now() - (entry.ts || 0) > 4 * 60 * 60 * 1000) return null;
  return entry;
}

/** Default cursor no espaço .board-lists (centro visível do scroller). */
export function defaultBoardPointer(boardId) {
  void boardId;
  const scroller = document.querySelector('.board-scroller');
  if (!scroller) return null;
  const rect = scroller.getBoundingClientRect();
  const clientX = rect.left + rect.width * 0.5;
  const clientY = rect.top + rect.height * 0.5;
  const content = boardListsContentPointFromClient(scroller, clientX, clientY);
  return {
    x: content.x,
    y: content.y,
    cursorScreen: { x: clientX, y: clientY },
  };
}

export function seedBoardCursorFields(boardId) {
  const last = getLastBoardPointer(boardId) || defaultBoardPointer(boardId);
  if (!last) return false;
  return last;
}
