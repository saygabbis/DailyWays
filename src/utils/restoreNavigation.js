import storageService, { STORAGE_KEYS } from '../services/storageService';

export const ACTIVE_VIEW_KEY = 'dailyways_active_view';
const SESSION_NAV_KEY = 'dailyways_session_nav';

const GENERAL_VIEWS = new Set(['dashboard', 'myday', 'important', 'planned', 'help']);

function parseStoredString(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'string' ? parsed : raw;
  } catch {
    return raw;
  }
}

export function readPersistedView() {
  try {
    const session = readSessionNavigation();
    if (session?.view) return session.view;
    const v = localStorage.getItem(ACTIVE_VIEW_KEY);
    return parseStoredString(v) || 'myday';
  } catch {
    return 'myday';
  }
}

export function persistView(view) {
  if (!view || view === 'settings') return;
  try {
    localStorage.setItem(ACTIVE_VIEW_KEY, view);
  } catch {
    /* ignore */
  }
}

export function persistActiveBoardId(boardId) {
  if (boardId) {
    storageService.save(STORAGE_KEYS.ACTIVE_BOARD, boardId);
  } else {
    storageService.remove(STORAGE_KEYS.ACTIVE_BOARD);
  }
}

export function readSessionNavigation() {
  try {
    const raw = sessionStorage.getItem(SESSION_NAV_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return {
      view: typeof data.view === 'string' ? data.view : null,
      boardId: typeof data.boardId === 'string' ? data.boardId : null,
    };
  } catch {
    return null;
  }
}

export function persistSessionNavigation(view, boardId) {
  try {
    sessionStorage.setItem(
      SESSION_NAV_KEY,
      JSON.stringify({ view: view || null, boardId: boardId || null }),
    );
  } catch {
    /* ignore */
  }
}

/** Keep view + board id in sync (local + session for reliable F5). */
export function persistNavigation(view, boardId) {
  persistView(view);
  persistSessionNavigation(view, boardId);
  if (boardId) {
    persistActiveBoardId(boardId);
  }
}

/** Update last board id without changing the current view (e.g. sidebar click). */
export function persistLastBoardId(boardId) {
  if (!boardId) return;
  persistActiveBoardId(boardId);
  const sess = readSessionNavigation();
  persistSessionNavigation(sess?.view || readPersistedView(), boardId);
}

function resolveBoardId(boards, ...candidates) {
  for (const id of candidates) {
    if (id && boards.some((b) => b.id === id)) return id;
  }
  return null;
}

/**
 * Resolve view + board id after workspace data is loaded.
 * @returns {{ view: string, boardId: string | null }}
 */
export function resolveRestoredNavigation({ boards = [], spaces = [], activeBoardHint = null }) {
  const session = readSessionNavigation();
  const saved = session?.view || readPersistedView();
  const storedBoard =
    session?.boardId
    || storageService.load(STORAGE_KEYS.ACTIVE_BOARD)
    || activeBoardHint;

  if (GENERAL_VIEWS.has(saved)) {
    return { view: saved, boardId: null };
  }

  if (saved.startsWith('space-')) {
    const spaceId = saved.slice('space-'.length);
    if (spaces.some((s) => s.id === spaceId)) {
      return { view: saved, boardId: null };
    }
    return { view: 'myday', boardId: null };
  }

  if (saved === 'board') {
    const boardId = resolveBoardId(boards, storedBoard);
    if (boardId) {
      return { view: 'board', boardId };
    }
    return { view: 'myday', boardId: null };
  }

  return { view: 'myday', boardId: null };
}

export function isGeneralView(view) {
  return GENERAL_VIEWS.has(view);
}

export function isWorkspaceDataReady({ userId, boards, boardsLoadError }) {
  if (!userId) return false;
  return boards.length > 0 || boardsLoadError != null;
}
