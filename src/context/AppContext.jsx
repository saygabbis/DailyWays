import { createContext, useContext, useReducer, useState, useEffect, useRef, useCallback } from 'react';
import storageService, { STORAGE_KEYS } from '../services/storageService';
import { fetchBoards, saveBoards, insertBoardFull, updateBoardFull, updateBoardsOrder } from '../services/boardService';
import { fetchGroups, fetchSpaces } from '../services/workspaceService';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabaseClient';
import ConfirmModal from '../components/Common/ConfirmModal';
import FloatingSaveError from '../components/Common/FloatingSaveError';

const AppContext = createContext(null);

const LABEL_COLORS = [
    { id: 'red', name: 'Vermelho', color: '#ff6b6b' },
    { id: 'orange', name: 'Laranja', color: '#ffa06b' },
    { id: 'yellow', name: 'Amarelo', color: '#ffd93d' },
    { id: 'green', name: 'Verde', color: '#6bcb77' },
    { id: 'blue', name: 'Azul', color: '#4d96ff' },
    { id: 'purple', name: 'Roxo', color: '#9b59b6' },
    { id: 'pink', name: 'Rosa', color: '#ff6b9d' },
    { id: 'teal', name: 'Teal', color: '#2ec4b6' },
];

const DEFAULT_BOARD_COLORS = [
    'linear-gradient(135deg, #7c3aed, #2563eb)',
    'linear-gradient(135deg, #ec4899, #f43f5e)',
    'linear-gradient(135deg, #06b6d4, #3b82f6)',
    'linear-gradient(135deg, #10b981, #059669)',
    'linear-gradient(135deg, #f59e0b, #ef4444)',
    'linear-gradient(135deg, #8b5cf6, #ec4899)',
    'linear-gradient(135deg, #14b8a6, #06b6d4)',
    'linear-gradient(135deg, #f97316, #fbbf24)',
];

const initialState = {
    boards: [],
    groups: [],
    spaces: [],
    activeBoard: null,
    selectedItems: [],
    selectionType: null, // 'board' | 'space' | null
    searchQuery: '',
    filterPriority: 'all',
    filterLabel: 'all',
    labels: [...LABEL_COLORS],
    savingBoardIds: [],
    pendingBoardIds: [], // boards com debounce agendado mas ainda não enviados ao servidor
    // Erros de save: [{ boardId, boardTitle, boardSnapshot, error }]
    // Cada entrada representa um save falho aguardando acao do usuario (retry ou revert)
    saveErrors: [],
    isDraggingBulk: false,
    showBoardToolbar: JSON.parse(localStorage.getItem('dailyways_show_toolbar') ?? 'true'),
    confirmModal: {
        show: false,
        title: '',
        message: '',
        onConfirm: null,
        onCancel: null,
        type: 'danger',
        confirmLabel: 'Confirmar',
        cancelLabel: 'Cancelar'
    }
};

function createDefaultBoards() {
    const boardId = crypto.randomUUID();
    return [{
        id: boardId,
        title: 'Meu Primeiro Board',
        color: DEFAULT_BOARD_COLORS[0],
        emoji: '🚀',
        createdAt: new Date().toISOString(),
        lists: [
            {
                id: crypto.randomUUID(),
                title: 'A Fazer',
                color: null,
                isCompletionList: false,
                cards: [
                    {
                        id: crypto.randomUUID(),
                        title: 'Bem-vindo ao DailyWays! 🎉',
                        description: 'Arraste este card para "Em Progresso" para começar!',
                        labels: ['blue'],
                        priority: 'medium',
                        dueDate: null,
                        myDay: true,
                        subtasks: [
                            { id: crypto.randomUUID(), title: 'Explorar o board', done: false },
                            { id: crypto.randomUUID(), title: 'Criar uma nova tarefa', done: false },
                            { id: crypto.randomUUID(), title: 'Experimentar drag & drop', done: false },
                        ],
                        createdAt: new Date().toISOString(),
                    },
                ],
            },
            {
                id: crypto.randomUUID(),
                title: 'Em Progresso',
                color: null,
                isCompletionList: false,
                cards: [],
            },
            {
                id: crypto.randomUUID(),
                title: 'Concluído',
                color: null,
                isCompletionList: true,
                cards: [],
            },
        ],
    }];
}

function appReducer(state, action) {
    switch (action.type) {
        // ── Boards ──
        case 'SET_BOARDS':
            return { ...state, boards: action.payload };

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
                id: action.payload.id || crypto.randomUUID(),
                title: action.payload.title || 'Novo Board',
                color: action.payload.color || DEFAULT_BOARD_COLORS[Math.floor(Math.random() * DEFAULT_BOARD_COLORS.length)],
                emoji: action.payload.emoji || '📋',
                createdAt: action.payload.createdAt || new Date().toISOString(),
                groupId: action.payload.groupId || null,
                position: action.payload.position ?? state.boards.length,
                // Aceita listas pré-criadas para manter IDs consistentes com o servidor
                lists: action.payload.lists || [
                    { id: crypto.randomUUID(), title: 'A Fazer', color: null, isCompletionList: false, cards: [] },
                    { id: crypto.randomUUID(), title: 'Em Progresso', color: null, isCompletionList: false, cards: [] },
                    { id: crypto.randomUUID(), title: 'Concluído', color: null, isCompletionList: true, cards: [] },
                ],
            };
            return { ...state, boards: [...state.boards, newBoard], activeBoard: newBoard.id };
        }

        case 'UPDATE_BOARD':
            return {
                ...state,
                boards: state.boards.map(b => b.id === action.payload.id ? { ...b, ...action.payload.updates } : b),
            };

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

        case 'SET_ACTIVE_BOARD':
            if (action.payload) {
                storageService.save(STORAGE_KEYS.ACTIVE_BOARD, action.payload);
            }
            return { ...state, activeBoard: action.payload };

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
                    id: crypto.randomUUID(),
                    title: `${board.title} (cópia)`,
                    createdAt: new Date().toISOString(),
                };
                dup.lists = dup.lists.map(l => ({
                    ...l,
                    id: crypto.randomUUID(),
                    cards: l.cards.map(c => ({
                        ...c,
                        id: crypto.randomUUID(),
                        subtasks: c.subtasks.map(st => ({ ...st, id: crypto.randomUUID() })),
                    })),
                }));
                return dup;
            };

            const duplicated = duplicateBoardStructure(orig);
            return { ...state, boards: [...state.boards, duplicated] };
        }

        case 'MOVE_LIST': {
            const { boardId: mlBoardId, sourceIndex: mlSrc, destIndex: mlDest } = action.payload;
            return {
                ...state,
                boards: state.boards.map(b => {
                    if (b.id !== mlBoardId) return b;
                    const newLists = [...b.lists];
                    const [movedList] = newLists.splice(mlSrc, 1);
                    newLists.splice(mlDest, 0, movedList);
                    return { ...b, lists: newLists };
                }),
            };
        }

        // ── Lists ──
        case 'ADD_LIST': {
            const newList = {
                id: crypto.randomUUID(),
                title: action.payload.title || 'Nova Lista',
                color: null,
                isCompletionList: false,
                cards: [],
                isNew: true // Simple flag for immediate animation
            };
            return {
                ...state,
                boards: state.boards.map(b =>
                    b.id === action.payload.boardId ? { ...b, lists: [...b.lists, newList] } : b
                ),
            };
        }

        case 'UPDATE_LIST':
            return {
                ...state,
                boards: state.boards.map(b =>
                    b.id === action.payload.boardId
                        ? {
                            ...b,
                            lists: b.lists.map(l =>
                                l.id === action.payload.listId ? { ...l, ...action.payload.updates } : l
                            ),
                        }
                        : b
                ),
            };

        case 'DELETE_LIST':
            return {
                ...state,
                boards: state.boards.map(b =>
                    b.id === action.payload.boardId
                        ? { ...b, lists: b.lists.filter(l => l.id !== action.payload.listId) }
                        : b
                ),
            };

        // ── Cards ──
        case 'ADD_CARD': {
            const newCard = {
                id: crypto.randomUUID(),
                title: action.payload.title || 'Nova Tarefa',
                description: '',
                labels: [],
                priority: 'none',
                dueDate: null,
                myDay: false,
                subtasks: [],
                createdAt: new Date().toISOString(),
                ...action.payload.cardData,
            };
            return {
                ...state,
                boards: state.boards.map(b =>
                    b.id === action.payload.boardId
                        ? {
                            ...b,
                            lists: b.lists.map(l =>
                                l.id === action.payload.listId ? { ...l, cards: [...l.cards, newCard] } : l
                            ),
                        }
                        : b
                ),
            };
        }

        case 'UPDATE_CARD':
            return {
                ...state,
                boards: state.boards.map(b =>
                    b.id === action.payload.boardId
                        ? {
                            ...b,
                            lists: b.lists.map(l =>
                                l.id === action.payload.listId
                                    ? {
                                        ...l,
                                        cards: l.cards.map(c =>
                                            c.id === action.payload.cardId ? { ...c, ...action.payload.updates } : c
                                        ),
                                    }
                                    : l
                            ),
                        }
                        : b
                ),
            };

        case 'DELETE_CARD':
            return {
                ...state,
                boards: state.boards.map(b =>
                    b.id === action.payload.boardId
                        ? {
                            ...b,
                            lists: b.lists.map(l =>
                                l.id === action.payload.listId
                                    ? { ...l, cards: l.cards.filter(c => c.id !== action.payload.cardId) }
                                    : l
                            ),
                        }
                        : b
                ),
            };

        case 'MOVE_CARD': {
            const { boardId, sourceListId, destListId, sourceIndex, destIndex } = action.payload;
            return {
                ...state,
                boards: state.boards.map(b => {
                    if (b.id !== boardId) return b;
                    const newLists = b.lists.map(l => ({ ...l, cards: [...l.cards] }));
                    const sourceList = newLists.find(l => l.id === sourceListId);
                    const destList = newLists.find(l => l.id === destListId);
                    if (!sourceList || !destList) return b;
                    const [movedCard] = sourceList.cards.splice(sourceIndex, 1);
                    destList.cards.splice(destIndex, 0, movedCard);
                    return { ...b, lists: newLists };
                }),
            };
        }

        // ── Subtasks ──
        case 'TOGGLE_SUBTASK':
            return {
                ...state,
                boards: state.boards.map(b =>
                    b.id === action.payload.boardId
                        ? {
                            ...b,
                            lists: b.lists.map(l =>
                                l.id === action.payload.listId
                                    ? {
                                        ...l,
                                        cards: l.cards.map(c =>
                                            c.id === action.payload.cardId
                                                ? {
                                                    ...c,
                                                    subtasks: c.subtasks.map(st =>
                                                        st.id === action.payload.subtaskId ? { ...st, done: !st.done } : st
                                                    ),
                                                }
                                                : c
                                        ),
                                    }
                                    : l
                            ),
                        }
                        : b
                ),
            };

        case 'ADD_SUBTASK': {
            const newSubtask = {
                id: crypto.randomUUID(),
                title: action.payload.title,
                done: false,
            };
            return {
                ...state,
                boards: state.boards.map(b =>
                    b.id === action.payload.boardId
                        ? {
                            ...b,
                            lists: b.lists.map(l =>
                                l.id === action.payload.listId
                                    ? {
                                        ...l,
                                        cards: l.cards.map(c =>
                                            c.id === action.payload.cardId
                                                ? { ...c, subtasks: [...c.subtasks, newSubtask] }
                                                : c
                                        ),
                                    }
                                    : l
                            ),
                        }
                        : b
                ),
            };
        }

        case 'DELETE_SUBTASK':
            return {
                ...state,
                boards: state.boards.map(b =>
                    b.id === action.payload.boardId
                        ? {
                            ...b,
                            lists: b.lists.map(l =>
                                l.id === action.payload.listId
                                    ? {
                                        ...l,
                                        cards: l.cards.map(c =>
                                            c.id === action.payload.cardId
                                                ? { ...c, subtasks: c.subtasks.filter(st => st.id !== action.payload.subtaskId) }
                                                : c
                                        ),
                                    }
                                    : l
                            ),
                        }
                        : b
                ),
            };

        // ── Filters ──
        case 'SET_SEARCH':
            return { ...state, searchQuery: action.payload };
        case 'SET_FILTER_PRIORITY':
            return { ...state, filterPriority: action.payload };
        case 'SET_FILTER_LABEL':
            return { ...state, filterLabel: action.payload };

        // ── Labels ──
        case 'ADD_LABEL':
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

export function AppProvider({ children }) {
    const { user } = useAuth();
    const userId = user?.id ?? null;
    // Ref do userId: atualizado sempre que o user muda (via onAuthStateChange).
    // Permite que os callbacks de save acessem o userId atual SEM chamar getSession(),
    // que pode travar durante um token refresh (o Supabase client usa lock interno).
    const userIdRef = useRef(userId);
    useEffect(() => { userIdRef.current = userId; }, [userId]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [recentlyAddedId, setRecentlyAddedId] = useState(null);
    const [lastReorderedIds, setLastReorderedIds] = useState([]);
    const [state, dispatch] = useReducer(appReducer, initialState);
    const stateRef = useRef(state);
    const initialLoadDone = useRef(false);
    const saveTimeoutRef = useRef({});
    const loadInProgressRef = useRef(false);
    // Unix timestamp (ms): ignore Realtime echo refetches until this time.
    // Set whenever THIS tab starts a local write to avoid overwriting optimistic state.
    const realtimeSuppressUntilRef = useRef(0);
    // Counter de saves ativos: enquanto > 0, o Realtime NÃO deve sobrescrever o estado local.
    // Isso evita que dados stale do servidor apaguem mudanças locais quando o upsert ainda está em andamento.
    const activeSavesRef = useRef(0);
    // Timestamp até quando aguardar antes de fazer HTTP (após TOKEN_REFRESHED).
    // O Supabase client tem um lock interno durante o refresh que trava requisições HTTP.
    // Após TOKEN_REFRESHED, aguardamos 2s para o lock ser liberado.
    const tokenRefreshCooldownRef = useRef(0);

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    const persistedEmptyClosedGroupsRef = useRef(new Set());
    useEffect(() => {
        if (!userId) return;
        (async () => {
            const { updateGroup } = await import('../services/workspaceService');
            const groups = state.groups || [];
            for (const g of groups) {
                if (g.type !== 'board' && g.type !== 'space') continue;
                const items = g.type === 'board' ? state.boards : state.spaces;
                const count = items.filter(i => i.groupId === g.id).length;
                if (count === 0 && !g.isExpanded) {
                    if (!persistedEmptyClosedGroupsRef.current.has(g.id)) {
                        persistedEmptyClosedGroupsRef.current.add(g.id);
                        try {
                            await updateGroup(g.id, { isExpanded: false });
                        } catch (e) { /* ignore */ }
                    }
                } else {
                    persistedEmptyClosedGroupsRef.current.delete(g.id);
                }
            }
        })();
    }, [userId, state.groups, state.boards, state.spaces]);

    // Rastreia TOKEN_REFRESHED e SIGNED_IN para aplicar cooldown antes de requisições HTTP.
    // Ambos os eventos causam um lock interno no Supabase client que trava HTTP requests
    // feitos logo em seguida (save imediatamente após refresh de aba minimizada, etc.).
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
                console.log(`[AppContext] ${event}: cooldown de 2s ativado para requisições HTTP`);
                tokenRefreshCooldownRef.current = Date.now() + 2000;
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    // Load boards: Supabase primeiro. Se der ERRO (sessão expirada, rede), NUNCA criar defaults:
    // usar localStorage como fallback e retentar a API depois. Só criar boards padrão quando a API
    // retornar sucesso com lista vazia (usuário novo).
    // IMPORTANTE: depende de [userId] (primitivo), NÃO de [user] (objeto),
    // para evitar re-execução quando refreshUser cria novo objeto com mesmo ID.
    useEffect(() => {
        if (!userId) {
            // Logout: limpar tudo para evitar race conditions no próximo login
            initialLoadDone.current = false;
            loadInProgressRef.current = false;
            // Cancelar qualquer persistência pendente
            Object.values(saveTimeoutRef.current || {}).forEach((timeoutId) => clearTimeout(timeoutId));
            saveTimeoutRef.current = {};
            // Resetar contador de saves ativos e supressão de Realtime
            activeSavesRef.current = 0;
            realtimeSuppressUntilRef.current = 0;
            dispatch({ type: 'SET_BOARDS', payload: [] });
            dispatch({ type: 'SET_GROUPS', payload: [] });
            dispatch({ type: 'SET_SPACES', payload: [] });
            dispatch({ type: 'CLEAR_SELECTION' });
            dispatch({ type: 'SET_ACTIVE_BOARD', payload: null });
            // Limpar listas de pendências, saves e erros ao sair
            dispatch({ type: 'SET_PENDING_BOARD', payload: { boardId: '__all__', pending: false } });
            dispatch({ type: 'CLEAR_SAVING' });
            dispatch({ type: 'CLEAR_SAVE_ERRORS' });
            console.log('[AppContext] User logout: state cleared');
            return;
        }
        if (loadInProgressRef.current) {
            console.log('[AppContext] Load already in progress, skipping');
            return;
        }
        loadInProgressRef.current = true;
        let cancelled = false;
        const localKey = STORAGE_KEYS.BOARDS + '_' + userId;

        const applyBoards = (boards, source) => {
            if (!cancelled && boards?.length > 0) {
                console.log(`[AppContext] applyBoards (${source}): ${boards.length} boards`);
                dispatch({ type: 'SET_BOARDS', payload: boards });

                // Restaurar último board ativo (apenas preferência de UI, não dados)
                const lastActive = storageService.load(STORAGE_KEYS.ACTIVE_BOARD);
                const activeId = (lastActive && boards.find(b => b.id === lastActive))
                    ? lastActive
                    : boards[0].id;

                dispatch({ type: 'SET_ACTIVE_BOARD', payload: activeId });
                // Sem localStorage para boards — fonte de verdade é 100% o servidor
            }
        };

        const loadFromApi = async (isRetry = false) => {
            console.log(`[AppContext] loadFromApi (retry=${isRetry}) for user ${userId.slice(0, 8)}...`);
            const { data: fromDb, error: fetchError } = await fetchBoards(userId);
            const { data: dbGroups, error: groupErr } = await fetchGroups(userId);
            const { data: dbSpaces, error: spaceErr } = await fetchSpaces(userId);

            if (cancelled) return { ok: false };
            if (fetchError || groupErr || spaceErr) {
                console.error('[AppContext] fetch error:', fetchError || groupErr || spaceErr);
                // Erro de rede/sessão: boards ficam como estão na memória.
                // Retry automático após 2s na primeira falha.
                if (!isRetry) {
                    setTimeout(() => loadFromApi(true), 2000);
                }
                return { ok: false };
            }

            dispatch({ type: 'SET_GROUPS', payload: dbGroups || [] });
            dispatch({ type: 'SET_SPACES', payload: dbSpaces || [] });

            if (fromDb.length > 0) {
                applyBoards(fromDb, 'supabase');
                return { ok: true };
            }
            // Supabase retornou sucesso com 0 boards = usuário novo. Criar defaults.
            console.log('[AppContext] Nenhum board no Supabase, criando defaults...');
            const defaults = createDefaultBoards();
            dispatch({ type: 'SET_BOARDS', payload: defaults });
            dispatch({ type: 'SET_ACTIVE_BOARD', payload: defaults[0].id });
            await saveBoards(userId, defaults);
            return { ok: true };
        };

        (async () => {
            try {
                await loadFromApi(false);
                if (!cancelled) {
                    initialLoadDone.current = true;
                    console.log('[AppContext] Initial load done');
                }
            } catch (err) {
                console.error('[AppContext] loadFromApi uncaught error:', err);
            } finally {
                loadInProgressRef.current = false;
            }
        })();
        return () => { cancelled = true; };
    }, [userId]);

    // ── Persistence: Optimized ──
    // Removemos o useEffect global que salvava tudo a cada mudança (causava race conditions).
    // Agora salvamos mudanças estruturais IMEDIATAMENTE e mudanças de texto com debounce por board.

    // Suppress Realtime echo refetches for 'ms' milliseconds from now.
    // Called before every local write so this tab ignores its own echo.
    const suppressRealtime = useCallback((ms = 2000) => {
        realtimeSuppressUntilRef.current = Date.now() + ms;
    }, []);

    // Helper central: retorna o userId ativo para uso nos saves.
    // → PRIMEIRO tenta o userIdRef (atualizado pelo onAuthStateChange do Supabase —
    //   não bloqueia durante token refresh, pois o Supabase client renova o token
    //   automaticamente nas chamadas HTTP sem precisarmos chamar getSession()).
    // → Fallback: chama getSession() com timeout de 8s caso o ref esteja vazio
    //   (sessão totalmente nula / logout real).
    const getFreshUserId = useCallback(async () => {
        // Fast path: se já temos o userId do contexto, retorna imediatamente.
        // O token será renovado automaticamente pelo Supabase client na chamada HTTP.
        if (userIdRef.current) {
            // Cooldown após TOKEN_REFRESHED: aguarda o lock interno do Supabase client ser liberado.
            // Sem isso, requisições HTTP logo após o refresh ficam presas no lock e travam.
            const cooldownMs = tokenRefreshCooldownRef.current - Date.now();
            if (cooldownMs > 0) {
                console.log(`[AppContext] getFreshUserId: aguardando cooldown pós-TOKEN_REFRESHED (${Math.round(cooldownMs)}ms)`);
                await new Promise(resolve => setTimeout(resolve, cooldownMs));
            }
            return userIdRef.current;
        }

        // Slow path: sessão pode estar null (primeira carga ou logout) — verifica no servidor.
        try {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('getSession timeout')), 8000)
            );
            const { data, error } = await Promise.race([
                supabase.auth.getSession(),
                timeoutPromise,
            ]);
            if (error || !data?.session?.user?.id) {
                console.warn('[AppContext] getFreshUserId: sessão inválida ou expirada', error?.message);
                return null;
            }
            // Atualiza o ref com o valor recém obtido
            userIdRef.current = data.session.user.id;
            return data.session.user.id;
        } catch (err) {
            console.error('[AppContext] getFreshUserId error:', err.message);
            return null;
        }
    }, []);

    // Helper para salvar um board específico de forma eficiente
    const persistBoard = useCallback(async (boardId) => {
        if (!userId || !initialLoadDone.current || !boardId) return;

        // Debounce por boardId: evita flood de updates caso o usuário faça várias
        // alterações rápidas (drag, check/uncheck subtasks, etc.).
        const timeouts = saveTimeoutRef.current || {};
        if (timeouts[boardId]) {
            clearTimeout(timeouts[boardId]);
        }

        // Mark local write start so the Realtime echo on this tab is suppressed
        suppressRealtime(2000);
        // Mark board as pending (debounce agendado)
        dispatch({ type: 'SET_PENDING_BOARD', payload: { boardId, pending: true } });

        timeouts[boardId] = setTimeout(async () => {
            // Debounce disparou: sai do pending para saving
            dispatch({ type: 'SET_PENDING_BOARD', payload: { boardId, pending: false } });
            dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId, saving: true } });
            activeSavesRef.current += 1;
            suppressRealtime(8000);

            // Safety timer de 10s: se o save travar por qualquer motivo (rede, sessão, etc),
            // libera o indicador E mostra o painel FloatingSaveError para o usuário agir.
            const safetyTimer = setTimeout(() => {
                console.warn('[AppContext] persistBoard: safety timeout (10s) para board', boardId);
                const stuckBoard = stateRef.current.boards.find(b => b.id === boardId);
                activeSavesRef.current = Math.max(0, activeSavesRef.current - 1);
                if (activeSavesRef.current === 0) suppressRealtime(500);
                dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId, saving: false } });
                dispatch({ type: 'SET_PENDING_BOARD', payload: { boardId, pending: false } });
                delete saveTimeoutRef.current[boardId];
                // Mostra painel de erro com snapshot atual para retry/revert
                dispatch({
                    type: 'PUSH_SAVE_ERROR',
                    payload: {
                        boardId,
                        boardTitle: stuckBoard?.title,
                        boardSnapshot: stuckBoard ? JSON.parse(JSON.stringify(stuckBoard)) : null,
                        error: 'Timeout: save travou. Verifique sua conexão.',
                    },
                });
            }, 10000);

            let boardSnapshot = null;
            try {
                const latestState = stateRef.current;
                const board = latestState.boards.find(b => b.id === boardId);
                if (!board) {
                    console.warn('[AppContext] persistBoard: board não encontrado', boardId);
                    return;
                }

                // Captura snapshot para rollback antes de qualquer operação destrutiva
                boardSnapshot = JSON.parse(JSON.stringify(board));

                // Obtém sessão fresca — resolve o bug de token refresh:
                // se o token foi renovado enquanto o debounce aguardava, getSession()
                // retorna o userId da sessão ativa com o novo token já configurado.
                const freshUserId = await getFreshUserId();
                if (!freshUserId) {
                    console.warn('[AppContext] persistBoard: sem sessão válida, abortando save de', boardId);
                    // Rollback: restaura o snapshot
                    dispatch({ type: 'SET_BOARDS', payload: stateRef.current.boards.map(b => b.id === boardId ? boardSnapshot : b) });
                    dispatch({
                        type: 'PUSH_SAVE_ERROR',
                        payload: { boardId, boardTitle: boardSnapshot?.title, boardSnapshot, error: 'Sessão expirada' }
                    });
                    return;
                }

                console.log(`[AppContext] persistBoard: salvando "${board.title}"`);
                // Promise.race: garante que mesmo se o AbortController do boardService
                // não funcionar, o catch aqui dispara em 8.5s (antes do safety timer de 10s).
                const saveTimeout = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Save timeout (8.5s): servidor não respondeu')), 8500)
                );
                const result = await Promise.race([updateBoardFull(freshUserId, board), saveTimeout]);

                if (!result?.success) {
                    throw new Error(result?.error || 'Falha ao salvar board');
                }
            } catch (err) {
                console.error('[AppContext] persistBoard error:', err);
                // Rollback: restaura o estado do board ao snapshot capturado antes do save
                if (boardSnapshot) {
                    dispatch({ type: 'SET_BOARDS', payload: stateRef.current.boards.map(b => b.id === boardId ? boardSnapshot : b) });
                    dispatch({
                        type: 'PUSH_SAVE_ERROR',
                        payload: { boardId, boardTitle: boardSnapshot.title, boardSnapshot, error: err?.message || 'Falha ao salvar' }
                    });
                }
            } finally {
                clearTimeout(safetyTimer);
                activeSavesRef.current = Math.max(0, activeSavesRef.current - 1);
                if (activeSavesRef.current === 0) suppressRealtime(500);
                dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId, saving: false } });
                delete saveTimeoutRef.current[boardId];
            }
        }, 400);

        saveTimeoutRef.current = timeouts;
    }, [userId, suppressRealtime, getFreshUserId]);

    // Salva todos os boards com debounce pendente imediatamente (usado pelo botão flutuante)
    const saveAllPending = useCallback(async () => {
        const timeouts = saveTimeoutRef.current;
        const pendingIds = Object.keys(timeouts);
        if (!pendingIds.length) return;

        // Obtém sessão fresca — garante que token refresh não interfira
        const freshUserId = await getFreshUserId();
        if (!freshUserId) {
            dispatch({
                type: 'PUSH_SAVE_ERROR',
                payload: { boardId: '__session__', boardTitle: null, boardSnapshot: null, error: 'Sessão expirada' }
            });
            return;
        }

        // Cancelar todos os timers de debounce pendentes
        pendingIds.forEach(id => clearTimeout(timeouts[id]));
        saveTimeoutRef.current = {};
        suppressRealtime(8000);
        activeSavesRef.current += pendingIds.length;

        // Salvar todos em paralelo
        await Promise.all(pendingIds.map(async (boardId) => {
            dispatch({ type: 'SET_PENDING_BOARD', payload: { boardId, pending: false } });
            const board = stateRef.current.boards.find(b => b.id === boardId);
            if (!board) {
                activeSavesRef.current = Math.max(0, activeSavesRef.current - 1);
                if (activeSavesRef.current === 0) suppressRealtime(500);
                dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId, saving: false } });
                return;
            }
            const boardSnapshot = JSON.parse(JSON.stringify(board));
            dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId, saving: true } });
            try {
                console.log(`[AppContext] saveAllPending: ${board.title}`);
                const result = await updateBoardFull(freshUserId, board);
                if (!result?.success) throw new Error(result?.error || 'Falha ao salvar');
            } catch (err) {
                console.error('[AppContext] saveAllPending error:', err);
                dispatch({ type: 'SET_BOARDS', payload: stateRef.current.boards.map(b => b.id === boardId ? boardSnapshot : b) });
                dispatch({
                    type: 'PUSH_SAVE_ERROR',
                    payload: { boardId, boardTitle: boardSnapshot.title, boardSnapshot, error: err?.message || 'Falha ao salvar' }
                });
            } finally {
                activeSavesRef.current = Math.max(0, activeSavesRef.current - 1);
                if (activeSavesRef.current === 0) suppressRealtime(500);
                dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId, saving: false } });
            }
        }));
    }, [suppressRealtime, getFreshUserId]);

    // Helper interno compartilhado para persistência imediata com rollback + token refresh
    const persistBoardImmediate = useCallback(async (boardId, updates) => {
        if (!boardId) return;
        // Snapshot do estado ANTES das mudanças locais (para rollback)
        const prevBoard = stateRef.current.boards.find(b => b.id === boardId);
        const boardSnapshot = prevBoard ? JSON.parse(JSON.stringify(prevBoard)) : null;

        dispatch({ type: 'UPDATE_BOARD', payload: { id: boardId, updates } });
        dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId, saving: true } });
        suppressRealtime(8000);
        activeSavesRef.current += 1;

        const safetyTimer = setTimeout(() => {
            console.warn('[AppContext] persistBoardImmediate: safety timeout (10s) para board', boardId);
            const stuckBoard = stateRef.current.boards.find(b => b.id === boardId);
            activeSavesRef.current = Math.max(0, activeSavesRef.current - 1);
            if (activeSavesRef.current === 0) suppressRealtime(500);
            dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId, saving: false } });
            // Mostra painel de erro com snapshot atual para retry/revert
            dispatch({
                type: 'PUSH_SAVE_ERROR',
                payload: {
                    boardId,
                    boardTitle: stuckBoard?.title,
                    boardSnapshot: stuckBoard ? JSON.parse(JSON.stringify(stuckBoard)) : null,
                    error: 'Timeout: save travou. Verifique sua conexão.',
                },
            });
        }, 10000);

        try {
            const freshUserId = await getFreshUserId();
            if (!freshUserId) {
                console.warn('[AppContext] persistBoardImmediate: sem sessão, abortando');
                if (boardSnapshot) {
                    dispatch({ type: 'SET_BOARDS', payload: stateRef.current.boards.map(b => b.id === boardId ? boardSnapshot : b) });
                    dispatch({
                        type: 'PUSH_SAVE_ERROR',
                        payload: { boardId, boardTitle: boardSnapshot?.title, boardSnapshot, error: 'Sessão expirada' }
                    });
                }
                return;
            }
            const board = stateRef.current.boards.find(b => b.id === boardId);
            if (!board) return;
            const saveTimeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Save timeout (8.5s): servidor não respondeu')), 8500)
            );
            const result = await Promise.race([updateBoardFull(freshUserId, { ...board, ...updates }), saveTimeout]);
            if (!result?.success) throw new Error(result?.error || 'Falha ao salvar');
        } catch (err) {
            console.error('[AppContext] persistBoardImmediate error:', err);
            if (boardSnapshot) {
                dispatch({ type: 'SET_BOARDS', payload: stateRef.current.boards.map(b => b.id === boardId ? boardSnapshot : b) });
                dispatch({
                    type: 'PUSH_SAVE_ERROR',
                    payload: { boardId, boardTitle: boardSnapshot?.title, boardSnapshot, error: err?.message || 'Falha ao salvar' }
                });
            }
        } finally {
            clearTimeout(safetyTimer);
            activeSavesRef.current = Math.max(0, activeSavesRef.current - 1);
            if (activeSavesRef.current === 0) suppressRealtime(500);
            dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId, saving: false } });
        }
    }, [suppressRealtime, getFreshUserId]);

    // Atualiza board no estado e persiste IMEDIATAMENTE (usado para Drag & Drop e mudanças estruturais)
    const updateBoardAndPersistImmediate = useCallback(async (boardId, updates) => {
        if (!boardId || !userId) return;
        await persistBoardImmediate(boardId, updates);
    }, [userId, persistBoardImmediate]);

    // Atualiza board no estado e persiste no banco imediatamente (otimizado para board específico).
    const updateBoardAndPersist = useCallback(async (boardId, updates) => {
        if (!boardId || !userId) return;
        await persistBoardImmediate(boardId, updates);
    }, [userId, persistBoardImmediate]);

    // ── Realtime: subscribe to postgres_changes for cross-tab / multi-user sync ──
    useEffect(() => {
        if (!userId) return;
        // Only subscribe after the initial load is done to avoid duplicate SET_BOARDS
        // We poll until initialLoadDone.current is true (it's a ref, so not tracked by React)
        let cancelled = false;
        let realtimeChannel = null;
        let debounceTimer = null;

        const waitAndSubscribe = () => {
            if (activeSavesRef.current > 0) {
                setTimeout(waitAndSubscribe, 200);
                return;
            }

            if (!initialLoadDone.current) {
                // Initial load not done yet — retry in 200ms
                setTimeout(waitAndSubscribe, 200);
                return;
            }

            const localKey = STORAGE_KEYS.BOARDS + '_' + userId;

            const handleChange = (payload) => {
                // If THIS tab triggered this write, skip the echo to avoid overwriting
                // optimistic local state with potentially stale server data.
                if (Date.now() < realtimeSuppressUntilRef.current || activeSavesRef.current > 0) {
                    return;
                }
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(async () => {
                    if (cancelled) return;
                    console.log('[AppContext] Realtime refetch for user', userId.slice(0, 8));
                    const { data, error } = await fetchBoards(userId);
                    if (cancelled || error || !data?.length) return;
                    dispatch({ type: 'SET_BOARDS', payload: data });
                    // Sem localStorage — servidor é a fonte de verdade
                }, 1000); // Increased debounce to 1s to prevent spam
            };

            realtimeChannel = supabase
                .channel('dailyways-sync-' + userId.slice(0, 8))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'boards' }, handleChange)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'lists' }, handleChange)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, handleChange)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'subtasks' }, handleChange)
                .subscribe();
        };

        waitAndSubscribe();

        return () => {
            cancelled = true;
            if (debounceTimer) clearTimeout(debounceTimer);
            if (realtimeChannel) {
                supabase.removeChannel(realtimeChannel);
            }
        };
    }, [userId]);

    const updateWorkspaceOrder = async (itemType, itemId, sourceGroupId, destGroupId, destIndex) => {
        if (!userId) return;

        const currentSelected = stateRef.current.selectedItems || [];
        // Only trigger bulk drag if the dragged item is part of the selection, and the type matches
        const matchesType = stateRef.current.selectionType === (itemType === 'spaces' ? 'space' : 'board');
        const isBulk = currentSelected.includes(itemId) && itemType !== 'groups' && matchesType;
        const itemIds = isBulk ? currentSelected : [itemId];
        // Source groups from current state (before dispatch) so reducer works even when Strict Mode runs twice
        const list = stateRef.current[itemType] || [];
        const payloadSourceGroupIds = [...new Set(itemIds.map(id => {
            const item = list.find(i => i.id === id);
            return item?.groupId;
        }).filter(Boolean))];

        dispatch({
            type: 'MOVE_WORKSPACE_ITEM',
            payload: { itemType, itemIds, destGroupId, destIndex, sourceGroupIds: payloadSourceGroupIds }
        });
        setLastReorderedIds(itemIds);
        setTimeout(() => setLastReorderedIds([]), 650);

        if (isBulk) {
            dispatch({ type: 'CLEAR_SELECTION' });
        }

        suppressRealtime(2000);
        // Compute the new order locally because stateRef.current is strictly stale right after dispatch
        const currentList = [...stateRef.current[itemType]];
        const groupType = itemType === 'boards' ? 'board' : 'space';
        const countBeforeByGroupId = {};
        (stateRef.current.groups || []).forEach(g => {
            if (g.type === groupType)
                countBeforeByGroupId[g.id] = currentList.filter(i => i.groupId === g.id).length;
        });

        const movedItems = [];
        for (const id of itemIds) {
            const idx = currentList.findIndex(i => i.id === id);
            if (idx >= 0) movedItems.push(currentList.splice(idx, 1)[0]);
        }

        if (itemType !== 'groups') {
            movedItems.forEach(item => item.groupId = destGroupId);
        }

        const itemsToUpdate = currentList.filter(i => (itemType === 'groups' ? true : i.groupId === destGroupId)).sort((a, b) => a.position - b.position);
        itemsToUpdate.splice(destIndex, 0, ...movedItems);
        itemsToUpdate.forEach((item, i) => { item.position = i; });

        let table = itemType; // 'boards', 'spaces', 'groups'
        const payloads = itemsToUpdate.map(item => ({
            id: item.id,
            position: item.position,
            groupId: itemType !== 'groups' ? item.groupId : undefined
        }));

        dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId: '__workspace_order__', saving: true } });
        try {
            const { updateEntitiesOrder, updateGroup } = await import('../services/workspaceService');
            await updateEntitiesOrder(table, payloads);

            // Persist isExpanded: false only for groups that had items and are now empty (we moved out of them)
            if (itemType !== 'groups') {
                const allItemsAfterMove = [...currentList, ...movedItems];
                const groups = stateRef.current.groups || [];
                for (const g of groups) {
                    if (g.type !== groupType) continue;
                    const hadItems = (countBeforeByGroupId[g.id] || 0) > 0;
                    const remaining = allItemsAfterMove.filter(i => i.groupId === g.id).length;
                    if (hadItems && remaining === 0) {
                        try { await updateGroup(g.id, { isExpanded: false }); } catch (e) { /* ignore */ }
                    }
                }
            }
        } catch (err) {
            console.error('[AppContext] Error updating order:', err);
        } finally {
            dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId: '__workspace_order__', saving: false } });
        }
    };

    // Helpers
    const getActiveBoard = () => state.boards.find(b => b.id === state.activeBoard);

    const getAllCards = () => {
        const cards = [];
        state.boards.forEach(board => {
            board.lists.forEach(list => {
                list.cards.forEach(card => {
                    cards.push({ ...card, boardId: board.id, listId: list.id, boardTitle: board.title, listTitle: list.title });
                });
            });
        });
        return cards;
    };

    const getMyDayCards = () => getAllCards().filter(c => c.myDay);

    const getImportantCards = () => getAllCards().filter(c => c.important || c.priority === 'high' || c.priority === 'urgent');

    const getPlannedCards = () => getAllCards().filter(c => c.dueDate);

    const searchCards = (query) => {
        if (!query) return [];
        const q = query.toLowerCase();
        return getAllCards().filter(c =>
            c.title.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)
        );
    };

    // ── Unified Confirm Modal ──
    const showConfirm = useCallback(({ title, message, type = 'danger', confirmLabel, cancelLabel }) => {
        return new Promise((resolve) => {
            dispatch({
                type: 'SHOW_CONFIRM',
                payload: {
                    title,
                    message,
                    type,
                    confirmLabel,
                    cancelLabel,
                    onConfirm: () => {
                        dispatch({ type: 'HIDE_CONFIRM' });
                        resolve(true);
                    },
                    onCancel: () => {
                        dispatch({ type: 'HIDE_CONFIRM' });
                        resolve(false);
                    }
                }
            });
        });
    }, []);

    // ── Retry / Revert save errors ──────────────────────────────────────────────────

    /**
     * Tenta salvar novamente um board que falhou.
     * Obtém sessão fresca (resolve token refresh) e persiste o estado atual do board.
     * Se funcionar, dismisses o erro do painel. Se falhar, mantém para o usuário tentar de novo.
     */
    const retryFailedSave = useCallback(async (boardId) => {
        if (!boardId || boardId === '__session__') {
            dispatch({ type: 'DISMISS_SAVE_ERROR', payload: boardId });
            return;
        }
        const board = stateRef.current.boards.find(b => b.id === boardId);
        if (!board) {
            dispatch({ type: 'DISMISS_SAVE_ERROR', payload: boardId });
            return;
        }
        dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId, saving: true } });
        suppressRealtime(8000);
        activeSavesRef.current += 1;
        try {
            const freshUserId = await getFreshUserId();
            if (!freshUserId) {
                console.warn('[AppContext] retryFailedSave: ainda sem sessão válida');
                return; // mantém o erro no painel
            }
            const result = await updateBoardFull(freshUserId, board);
            if (!result?.success) throw new Error(result?.error || 'Falha ao salvar');
            console.log('[AppContext] retryFailedSave OK:', board.title);
            dispatch({ type: 'DISMISS_SAVE_ERROR', payload: boardId });
        } catch (err) {
            console.error('[AppContext] retryFailedSave error:', err);
            // Mantém o erro no painel; usuário pode tentar de novo ou reverter
        } finally {
            activeSavesRef.current = Math.max(0, activeSavesRef.current - 1);
            if (activeSavesRef.current === 0) suppressRealtime(500);
            dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId, saving: false } });
        }
    }, [getFreshUserId, suppressRealtime]);

    /**
     * Descarta as alterações locais e recarrega a página para restaurar o estado
     * salvo no servidor. Garante reconexão limpa ao banco e token fresco.
     */
    const revertFailedSave = useCallback(async (boardId) => {
        dispatch({ type: 'DISMISS_SAVE_ERROR', payload: boardId });
        // Recarregar a página: token refreshed garantido, reconexão limpa ao banco,
        // estado recarregado do servidor sem risco de dados corrompidos localmente.
        window.location.reload();
    }, []);

    const confirmConfig = state.confirmModal;

    const isSavingBoard = useCallback((boardId) => state.savingBoardIds.includes(boardId), [state.savingBoardIds]);
    const hasUnsavedChanges = state.pendingBoardIds.length > 0 || state.savingBoardIds.length > 0;

    return (
        <AppContext.Provider value={{
            state,
            dispatch,
            getActiveBoard,
            getAllCards,
            getMyDayCards,
            getImportantCards,
            getPlannedCards,
            searchCards,
            updateBoardAndPersist,
            updateBoardAndPersistImmediate,
            updateBoardsOrder,
            isSidebarOpen, setIsSidebarOpen,
            confirmConfig, showConfirm,
            recentlyAddedId, setRecentlyAddedId,
            lastReorderedIds, setLastReorderedIds,
            persistBoard,
            saveAllPending,
            suppressRealtime,
            savingBoardIds: state.savingBoardIds,
            pendingBoardIds: state.pendingBoardIds,
            saveErrors: state.saveErrors,
            retryFailedSave,
            revertFailedSave,
            showBoardToolbar: state.showBoardToolbar,
            isSavingBoard,
            hasUnsavedChanges,
            LABEL_COLORS: state.labels,
            DEFAULT_BOARD_COLORS,
            updateWorkspaceOrder,
        }}>
            {children}
            {/* Global Confirm Modal */}
            <ConfirmModal
                show={state.confirmModal.show}
                title={state.confirmModal.title}
                message={state.confirmModal.message}
                onConfirm={state.confirmModal.onConfirm}
                onCancel={state.confirmModal.onCancel}
                type={state.confirmModal.type}
                confirmLabel={state.confirmModal.confirmLabel}
                cancelLabel={state.confirmModal.cancelLabel}
            />
            {/* Painel flutuante de erro de save */}
            <FloatingSaveError />
        </AppContext.Provider>
    );
}

export const useApp = () => {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useApp must be used within AppProvider');
    return ctx;
};
