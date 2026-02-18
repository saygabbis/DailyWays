import { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import storageService, { STORAGE_KEYS } from '../services/storageService';
import { fetchBoards, saveBoards, insertBoardFull } from '../services/boardService';
import { useAuth } from './AuthContext';

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
    activeBoard: null,
    searchQuery: '',
    filterPriority: 'all',
    filterLabel: 'all',
    labels: [...LABEL_COLORS],
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
                cards: [],
            },
            {
                id: crypto.randomUUID(),
                title: 'Concluído',
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

        case 'ADD_BOARD': {
            const newBoard = {
                id: crypto.randomUUID(),
                title: action.payload.title || 'Novo Board',
                color: action.payload.color || DEFAULT_BOARD_COLORS[Math.floor(Math.random() * DEFAULT_BOARD_COLORS.length)],
                emoji: action.payload.emoji || '📋',
                createdAt: new Date().toISOString(),
                lists: [
                    { id: crypto.randomUUID(), title: 'A Fazer', cards: [] },
                    { id: crypto.randomUUID(), title: 'Em Progresso', cards: [] },
                    { id: crypto.randomUUID(), title: 'Concluído', cards: [] },
                ],
            };
            return { ...state, boards: [...state.boards, newBoard], activeBoard: newBoard.id };
        }

        case 'UPDATE_BOARD':
            return {
                ...state,
                boards: state.boards.map(b => b.id === action.payload.id ? { ...b, ...action.payload.updates } : b),
            };

        case 'DELETE_BOARD':
            return {
                ...state,
                boards: state.boards.filter(b => b.id !== action.payload),
                activeBoard: state.activeBoard === action.payload ? null : state.activeBoard,
            };

        case 'SET_ACTIVE_BOARD':
            return { ...state, activeBoard: action.payload };

        case 'REORDER_BOARDS': {
            const { sourceIndex, destIndex } = action.payload;
            const newBoards = [...state.boards];
            const [moved] = newBoards.splice(sourceIndex, 1);
            newBoards.splice(destIndex, 0, moved);
            return { ...state, boards: newBoards };
        }

        case 'DUPLICATE_BOARD': {
            const orig = state.boards.find(b => b.id === action.payload);
            if (!orig) return state;
            const dup = {
                ...JSON.parse(JSON.stringify(orig)),
                id: crypto.randomUUID(),
                title: `${orig.title} (cópia)`,
                createdAt: new Date().toISOString(),
            };
            // Give new IDs to all sublists and cards
            dup.lists = dup.lists.map(l => ({
                ...l,
                id: crypto.randomUUID(),
                cards: l.cards.map(c => ({
                    ...c,
                    id: crypto.randomUUID(),
                    subtasks: c.subtasks.map(st => ({ ...st, id: crypto.randomUUID() })),
                })),
            }));
            return { ...state, boards: [...state.boards, dup] };
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
                cards: [],
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

        default:
            return state;
    }
}

export function AppProvider({ children }) {
    const { user } = useAuth();
    const [state, dispatch] = useReducer(appReducer, initialState);
    const initialLoadDone = useRef(false);
    const saveTimeoutRef = useRef(null);

    // Load boards: Supabase primeiro; se vazio, tenta localStorage (backup) e sincroniza para Supabase
    useEffect(() => {
        if (!user) {
            initialLoadDone.current = false;
            return;
        }
        let cancelled = false;
        const localKey = STORAGE_KEYS.BOARDS + '_' + user.id;
        (async () => {
            const fromDb = await fetchBoards(user.id);
            if (cancelled) return;
            if (fromDb?.length > 0) {
                dispatch({ type: 'SET_BOARDS', payload: fromDb });
                dispatch({ type: 'SET_ACTIVE_BOARD', payload: fromDb[0].id });
                storageService.save(localKey, fromDb);
                initialLoadDone.current = true;
                return;
            }
            const fromLocal = storageService.load(localKey);
            if (fromLocal && Array.isArray(fromLocal) && fromLocal.length > 0) {
                dispatch({ type: 'SET_BOARDS', payload: fromLocal });
                dispatch({ type: 'SET_ACTIVE_BOARD', payload: fromLocal[0].id });
                initialLoadDone.current = true;
                for (const board of fromLocal) {
                    await insertBoardFull(user.id, board);
                }
                storageService.save(localKey, fromLocal);
                return;
            }
            const defaults = createDefaultBoards();
            dispatch({ type: 'SET_BOARDS', payload: defaults });
            dispatch({ type: 'SET_ACTIVE_BOARD', payload: defaults[0].id });
            const saved = await saveBoards(user.id, defaults);
            if (saved.success) storageService.save(localKey, defaults);
            initialLoadDone.current = true;
        })();
        return () => { cancelled = true; };
    }, [user]);

    // Persist boards: Supabase + localStorage (backup). Debounce curto para não perder em F5.
    useEffect(() => {
        if (!user || !initialLoadDone.current || state.boards.length === 0) return;
        const boardsToSave = state.boards;
        const localKey = STORAGE_KEYS.BOARDS + '_' + user.id;
        storageService.save(localKey, boardsToSave);
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(async () => {
            saveTimeoutRef.current = null;
            const result = await saveBoards(user.id, boardsToSave);
            if (result.success) storageService.save(localKey, boardsToSave);
        }, 400);
        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        };
    }, [state.boards, user]);

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

    const getImportantCards = () => getAllCards().filter(c => c.priority === 'high' || c.priority === 'urgent');

    const getPlannedCards = () => getAllCards().filter(c => c.dueDate);

    const searchCards = (query) => {
        if (!query) return [];
        const q = query.toLowerCase();
        return getAllCards().filter(c =>
            c.title.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)
        );
    };

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
            LABEL_COLORS: state.labels,
            DEFAULT_BOARD_COLORS,
        }}>
            {children}
        </AppContext.Provider>
    );
}

export const useApp = () => {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useApp must be used within AppProvider');
    return ctx;
};
