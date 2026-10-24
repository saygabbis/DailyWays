/** Reducer global do app (boards, grupos, spaces, seleção, modais). Puro: sem efeitos colaterais. */
import { applyBoardAction } from '@dailyways/collab-protocol';
import { COUNT } from '@dailyways/limits';
import { uuidv4 } from '../../utils/uuid';
import storageService, { STORAGE_KEYS } from '../../services/storageService';
import { DEFAULT_BOARD_COLORS } from './appDefaults';
import { persistLastBoardId } from '../../utils/restoreNavigation.js';

const BOARD_APPLY_ACTION_TYPES = new Set([
  'UPDATE_BOARD',
  'ADD_LIST',
  'UPDATE_LIST',
  'DELETE_LIST',
  'MOVE_LIST',
  'ADD_CARD',
  'UPDATE_CARD',
  'DELETE_CARD',
  'MOVE_CARD',
  'TOGGLE_SUBTASK',
  'ADD_SUBTASK',
  'UPDATE_SUBTASK',
  'DELETE_SUBTASK',
]);

function applyBoardActionToState(state, action) {
  const targetId = action.type === 'UPDATE_BOARD'
    ? action.payload?.id
    : action.payload?.boardId;
  if (!targetId) return state;

  return {
    ...state,
    boards: state.boards.map((b) => {
      if (b.id !== targetId) return b;
      const next = applyBoardAction(b, action);
      if (action.type === 'ADD_LIST' && next.lists.length > b.lists.length) {
        const added = next.lists.find((l) => !b.lists.some((bl) => bl.id === l.id));
        if (added) {
          return {
            ...next,
            lists: next.lists.map((l) =>
              (l.id === added.id ? { ...l, isNew: true } : l)),
          };
        }
      }
      return next;
    }),
  };
}

export function appReducer(state, action) {
    if (BOARD_APPLY_ACTION_TYPES.has(action.type)) {
        return applyBoardActionToState(state, action);
    }

    switch (action.type) {
        // ── Boards ──
        case 'SET_BOARDS': {
            const boards = action.payload ?? [];
            const validActive = state.activeBoard && boards.some((b) => b.id === state.activeBoard);
            const lastStored = storageService.load(STORAGE_KEYS.ACTIVE_BOARD);
            const storedValid = lastStored && boards.some((b) => b.id === lastStored);
            const nextActive = validActive
                ? state.activeBoard
                : (storedValid ? lastStored : state.activeBoard);
            return { ...state, boards, activeBoard: nextActive };
        }

        // ── Groups ──
        case 'SET_GROUPS': {
            const merged = (action.payload || []).map(g => {
                const current = state.groups.find(c => c.id === g.id);
                const items = g.type === 'board' ? state.boards : state.spaces;
                const count = (items || []).filter(i => i.groupId === g.id).length;
                if (count === 0 && current?.isExpanded === false)
                    return { ...g, isExpanded: false };
                return g;
            });
            return { ...state, groups: merged };
        }
        case 'ADD_GROUP':
            return { ...state, groups: [...state.groups, action.payload] };
        case 'UPDATE_GROUP':
            return {
                ...state,
                groups: state.groups.map(g => g.id === action.payload.id ? { ...g, ...action.payload.updates } : g)
            };
        case 'DELETE_GROUP':
            return { ...state, groups: state.groups.filter(g => g.id !== action.payload) };

        // ── Spaces ──
        case 'SET_SPACES':
            return { ...state, spaces: action.payload };
        case 'ADD_SPACE':
            return { ...state, spaces: [...state.spaces, { ...action.payload, groupId: action.payload.groupId || null }] };
        case 'UPDATE_SPACE':
            return {
                ...state,
                spaces: state.spaces.map(s => s.id === action.payload.id ? { ...s, ...action.payload.updates } : s)
            };
        case 'DELETE_SPACE': {
            const deletedSpace = state.spaces.find(s => s.id === action.payload);
            const groupId = deletedSpace?.groupId;
            const newSpaces = state.spaces.filter(s => s.id !== action.payload);
            let newGroups = state.groups;
            if (groupId) {
                const remainingInGroup = newSpaces.filter(s => s.groupId === groupId);
                if (remainingInGroup.length === 0) {
                    newGroups = state.groups.map(g =>
                        g.id === groupId ? { ...g, isExpanded: false } : g
                    );
                }
            }
            return { ...state, spaces: newSpaces, groups: newGroups };
        }

        // ── Selection ──
        case 'SET_SELECTION':
            return { ...state, selectedItems: action.payload.items, selectionType: action.payload.type };
        case 'CLEAR_SELECTION':
            return { ...state, selectedItems: [], selectionType: null };
        case 'TOGGLE_SELECTION': {
            const { id, type } = action.payload;
            if (state.selectionType && state.selectionType !== type) {
                // Se o tipo mudou (ex: board pra space), recomeça a seleção
                return { ...state, selectedItems: [id], selectionType: type };
            }
            const isSelected = state.selectedItems.includes(id);
            const newSelected = isSelected ? state.selectedItems.filter(i => i !== id) : [...state.selectedItems, id];
            return { ...state, selectedItems: newSelected, selectionType: newSelected.length > 0 ? type : null };
        }
        case 'DELETE_SELECTED_ITEMS': {
            if (state.selectionType === 'board') {
                const groupIdsAffected = new Set(
                    state.boards.filter(b => state.selectedItems.includes(b.id)).map(b => b.groupId).filter(Boolean)
                );
                const newBoards = state.boards.filter(b => !state.selectedItems.includes(b.id));
                let newGroups = state.groups;
                groupIdsAffected.forEach(gid => {
                    if (newBoards.filter(b => b.groupId === gid).length === 0) {
                        newGroups = newGroups.map(g => (g.id === gid ? { ...g, isExpanded: false } : g));
                    }
                });
                return {
                    ...state,
                    boards: newBoards,
                    groups: newGroups,
                    selectedItems: [],
                    selectionType: null,
                    activeBoard: state.selectedItems.includes(state.activeBoard) ? null : state.activeBoard
                };
            } else if (state.selectionType === 'space') {
                const groupIdsAffected = new Set(
                    state.spaces.filter(s => state.selectedItems.includes(s.id)).map(s => s.groupId).filter(Boolean)
                );
                const newSpaces = state.spaces.filter(s => !state.selectedItems.includes(s.id));
                let newGroups = state.groups;
                groupIdsAffected.forEach(gid => {
                    if (newSpaces.filter(s => s.groupId === gid).length === 0) {
                        newGroups = newGroups.map(g => (g.id === gid ? { ...g, isExpanded: false } : g));
                    }
                });
                return {
                    ...state,
                    spaces: newSpaces,
                    groups: newGroups,
                    selectedItems: [],
                    selectionType: null
                };
            } else if (state.selectionType === 'group') {
                return {
                    ...state,
                    groups: state.groups.filter(g => !state.selectedItems.includes(g.id)),
                    selectedItems: [],
                    selectionType: null
                };
            }
            return state;
        }

        case 'ADD_BOARD': {
            const newBoard = {
                // Aceita id pré-gerado (para consistência com o que foi salvo no servidor)
                id: action.payload.id || uuidv4(),
                ownerId: action.payload.ownerId ?? null,
                title: action.payload.title || 'Novo Board',
                color: action.payload.color || DEFAULT_BOARD_COLORS[Math.floor(Math.random() * DEFAULT_BOARD_COLORS.length)],
                emoji: action.payload.emoji || '📋',
                createdAt: action.payload.createdAt || new Date().toISOString(),
                groupId: action.payload.groupId || null,
                position: action.payload.position ?? state.boards.length,
                // Aceita listas pré-criadas para manter IDs consistentes com o servidor
                lists: action.payload.lists || [
                    { id: uuidv4(), title: 'A Fazer', color: null, isCompletionList: false, cards: [] },
                    { id: uuidv4(), title: 'Em Progresso', color: null, isCompletionList: false, cards: [] },
                    { id: uuidv4(), title: 'Concluído', color: null, isCompletionList: true, cards: [] },
                ],
            };
            return { ...state, boards: [...state.boards, newBoard], activeBoard: newBoard.id };
        }

        case 'UPDATE_BOARD':
            return {
                ...state,
                boards: state.boards.map(b => b.id === action.payload.id ? { ...b, ...action.payload.updates } : b),
            };

        // Realtime: versão do banco de UM board (troca ou acrescenta, sem mexer no resto do estado).
        case 'REPLACE_BOARD_FROM_SERVER': {
            const board = action.payload;
            if (!board?.id) return state;
            const exists = state.boards.some((b) => b.id === board.id);
            return {
                ...state,
                boards: exists ? state.boards.map((b) => (b.id === board.id ? board : b)) : [...state.boards, board],
            };
        }

        case 'DELETE_BOARD': {
            const deletedBoard = state.boards.find(b => b.id === action.payload);
            const groupId = deletedBoard?.groupId;
            const newBoards = state.boards.filter(b => b.id !== action.payload);
            let newGroups = state.groups;
            if (groupId) {
                const remainingInGroup = newBoards.filter(b => b.groupId === groupId);
                if (remainingInGroup.length === 0) {
                    newGroups = state.groups.map(g =>
                        g.id === groupId ? { ...g, isExpanded: false } : g
                    );
                }
            }
            return {
                ...state,
                boards: newBoards,
                groups: newGroups,
                activeBoard: state.activeBoard === action.payload ? null : state.activeBoard,
                selectedItems: state.selectedItems.filter(id => id !== action.payload)
            };
        }

        case 'SET_ACTIVE_BOARD': {
            if (action.payload) {
                storageService.save(STORAGE_KEYS.ACTIVE_BOARD, action.payload);
                persistLastBoardId(action.payload);
            } else {
                storageService.remove(STORAGE_KEYS.ACTIVE_BOARD);
            }
            return { ...state, activeBoard: action.payload };
        }

        case 'MOVE_WORKSPACE_ITEM': {
            const { itemType, itemIds, destGroupId, destIndex, sourceGroupIds: payloadSourceGroupIds } = action.payload;
            // Deep-clone items to avoid mutating state in place
            const list = state[itemType].map(i => ({ ...i }));

            // Use source groups from payload (computed before dispatch) so we close correctly even when Strict Mode runs reducer twice
            const sourceGroupIds = new Set(Array.isArray(payloadSourceGroupIds) ? payloadSourceGroupIds : []);
            if (sourceGroupIds.size === 0) {
                for (const id of itemIds) {
                    const item = list.find(i => i.id === id);
                    if (item?.groupId) sourceGroupIds.add(item.groupId);
                }
            }

            const movedItems = [];
            for (const id of itemIds) {
                const idx = list.findIndex(i => i.id === id);
                if (idx >= 0) {
                    movedItems.push(list.splice(idx, 1)[0]);
                }
            }
            if (movedItems.length === 0) return state;

            if (itemType !== 'groups') {
                movedItems.forEach(item => { item.groupId = destGroupId; });
            }

            const itemsInDest = list
                .filter(i => (itemType === 'groups' ? true : i.groupId === destGroupId))
                .sort((a, b) => a.position - b.position);
            itemsInDest.splice(destIndex, 0, ...movedItems);

            itemsInDest.forEach((item, i) => {
                item.position = i;
            });

            const rest = list.filter(i => (itemType === 'groups' ? false : i.groupId !== destGroupId));
            const newList = [...rest, ...itemsInDest];

            // Close only groups that had items and are now empty (we moved items out of them)
            let updatedGroups = state.groups;
            if (itemType !== 'groups') {
                updatedGroups = state.groups.map(g => {
                    if (g.type !== itemType.slice(0, -1)) return g;
                    const remainingInNew = newList.filter(i => i.groupId === g.id).length;
                    const willClose = sourceGroupIds.has(g.id) && remainingInNew === 0;
                    if (willClose)
                        return { ...g, isExpanded: false };
                    return g;
                });
            }

            return { ...state, [itemType]: newList, groups: updatedGroups };
        }

        case 'DUPLICATE_BOARD': {
            const orig = state.boards.find(b => b.id === action.payload);
            if (!orig) return state;

            const duplicateBoardStructure = (board) => {
                const dup = {
                    ...JSON.parse(JSON.stringify(board)),
                    id: uuidv4(),
                    title: `${board.title} (cópia)`,
                    createdAt: new Date().toISOString(),
                };
                dup.lists = dup.lists.map(l => ({
                    ...l,
                    id: uuidv4(),
                    cards: l.cards.map(c => ({
                        ...c,
                        id: uuidv4(),
                        subtasks: c.subtasks.map(st => ({ ...st, id: uuidv4() })),
                    })),
                }));
                return dup;
            };

            const duplicated = duplicateBoardStructure(orig);
            return { ...state, boards: [...state.boards, duplicated] };
        }

        // ── Filters ──
        case 'SET_SEARCH':
            return { ...state, searchQuery: action.payload };
        case 'SET_FILTER_PRIORITY':
            return { ...state, filterPriority: action.payload };
        case 'SET_FILTER_LABEL':
            return { ...state, filterLabel: action.payload };

        // ── Labels ──
        case 'ADD_LABEL':
            if (state.labels.length >= COUNT.labelsPerBoard) return state;
            return { ...state, labels: [...state.labels, action.payload] };

        case 'DELETE_LABEL':
            return {
                ...state,
                labels: state.labels.filter(l => l.id !== action.payload),
                // Cleanup removed label from all cards
                boards: state.boards.map(b => ({
                    ...b,
                    lists: b.lists.map(l => ({
                        ...l,
                        cards: l.cards.map(c => ({
                            ...c,
                            labels: c.labels.filter(lid => lid !== action.payload)
                        }))
                    }))
                }))
            };

        // ── Saving indicator ──
        case 'SET_SAVING_BOARD': {
            const { boardId: sbId, saving } = action.payload;
            return {
                ...state,
                savingBoardIds: saving
                    ? [...new Set([...state.savingBoardIds, sbId])]
                    : state.savingBoardIds.filter(id => id !== sbId),
            };
        }

        case 'CLEAR_SAVING':
            return { ...state, savingBoardIds: [] };

        // ── Save Errors (para o FloatingSaveError) ──
        // Adiciona um erro de save (boardSnapshot armazenado para rollback)
        case 'PUSH_SAVE_ERROR': {
            const existing = state.saveErrors.filter(e => e.boardId !== action.payload.boardId);
            return { ...state, saveErrors: [...existing, action.payload] };
        }
        // Remove o erro de um board (após retry com sucesso ou revert)
        case 'DISMISS_SAVE_ERROR': {
            return { ...state, saveErrors: state.saveErrors.filter(e => e.boardId !== action.payload) };
        }
        case 'CLEAR_SAVE_ERRORS':
            return { ...state, saveErrors: [] };

        // ── Pending (debounce agendado, ainda não enviado ao servidor) ──
        case 'SET_PENDING_BOARD': {
            const { boardId: pbId, pending } = action.payload;
            if (pbId === '__all__') return { ...state, pendingBoardIds: [] };
            return {
                ...state,
                pendingBoardIds: pending
                    ? [...new Set([...state.pendingBoardIds, pbId])]
                    : state.pendingBoardIds.filter(id => id !== pbId),
            };
        }

        case 'TOGGLE_BOARD_TOOLBAR': {
            const newValue = action.payload !== undefined ? action.payload : !state.showBoardToolbar;
            localStorage.setItem('dailyways_show_toolbar', JSON.stringify(newValue));
            return { ...state, showBoardToolbar: newValue };
        }

        case 'SET_PROFILE_MENU_OPEN':
            return { ...state, profileMenuOpen: Boolean(action.payload) };

        case 'SET_BOARDS_LOAD_ERROR':
            return { ...state, boardsLoadError: action.payload ?? null };

        case 'SHOW_CONFIRM':
            return { ...state, confirmModal: { ...action.payload, show: true } };

        case 'HIDE_CONFIRM':
            return {
                ...state,
                confirmModal: { ...state.confirmModal, show: false }
            };

        case 'SET_DRAGGING_BULK':
            return {
                ...state,
                isDraggingBulk: action.payload
            };

        default:
            return state;
    }
}
