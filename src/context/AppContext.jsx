import { createContext, useContext, useReducer, useState, useEffect, useRef, useCallback } from 'react';
import storageService, { STORAGE_KEYS } from '../services/storageService';
import { fetchBoards, saveBoards, insertBoardFull, updateBoardFull, updateBoardsOrder } from '../services/boardService';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabaseClient';
import ConfirmModal from '../components/Common/ConfirmModal';

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
    savingBoardIds: [],
    pendingBoardIds: [], // boards com debounce agendado mas ainda não enviados ao servidor
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

        case 'ADD_BOARD': {
            const newBoard = {
                // Aceita id pré-gerado (para consistência com o que foi salvo no servidor)
                id: action.payload.id || crypto.randomUUID(),
                title: action.payload.title || 'Novo Board',
                color: action.payload.color || DEFAULT_BOARD_COLORS[Math.floor(Math.random() * DEFAULT_BOARD_COLORS.length)],
                emoji: action.payload.emoji || '📋',
                createdAt: action.payload.createdAt || new Date().toISOString(),
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

        case 'DELETE_BOARD':
            return {
                ...state,
                boards: state.boards.filter(b => b.id !== action.payload),
                activeBoard: state.activeBoard === action.payload ? null : state.activeBoard,
            };

        case 'SET_ACTIVE_BOARD':
            if (action.payload) {
                storageService.save(STORAGE_KEYS.ACTIVE_BOARD, action.payload);
            }
            return { ...state, activeBoard: action.payload };

        case 'REORDER_BOARDS': {
            const { sourceIndex, destIndex } = action.payload;
            const newBoards = [...state.boards];
            const [moved] = newBoards.splice(sourceIndex, 1);
            newBoards.splice(destIndex, 0, moved);

            // Update position fields to match new index
            const updatedBoards = newBoards.map((b, i) => ({ ...b, position: i }));
            return { ...state, boards: updatedBoards };
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

        default:
            return state;
    }
}

export function AppProvider({ children }) {
    const { user } = useAuth();
    const userId = user?.id ?? null;
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [recentlyAddedId, setRecentlyAddedId] = useState(null);
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

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

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
            dispatch({ type: 'SET_BOARDS', payload: [] });
            dispatch({ type: 'SET_ACTIVE_BOARD', payload: null });
            // Limpar lista de pendências ao sair
            dispatch({ type: 'SET_PENDING_BOARD', payload: { boardId: '__all__', pending: false } });
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
            if (cancelled) return { ok: false };
            if (fetchError) {
                console.error('[AppContext] fetchBoards error:', fetchError);
                // Erro de rede/sessão: boards ficam como estão na memória.
                // Retry automático após 2s na primeira falha.
                if (!isRetry) {
                    setTimeout(() => loadFromApi(true), 2000);
                }
                return { ok: false };
            }
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
            // Bloquear Realtime enquanto o upsert estiver em andamento
            activeSavesRef.current += 1;
            suppressRealtime(8000); // Estender supressão para cobrir a duração do upsert
            try {
                const latestState = stateRef.current;
                const board = latestState.boards.find(b => b.id === boardId);
                if (!board) return;
                console.log(`[AppContext] persistBoard (debounced): ${board.title}`);
                await updateBoardFull(userId, board);
            } catch (err) {
                console.error('[AppContext] persistBoard error:', err);
            } finally {
                activeSavesRef.current = Math.max(0, activeSavesRef.current - 1);
                // Se não há mais saves ativos, atualizar supressão para 500ms apenas
                if (activeSavesRef.current === 0) suppressRealtime(500);
                dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId, saving: false } });
                // Limpar o timeout do ref
                delete saveTimeoutRef.current[boardId];
            }
        }, 400);

        saveTimeoutRef.current = timeouts;
    }, [userId, suppressRealtime]);

    // Salva todos os boards com debounce pendente imediatamente (usado pelo botão flutuante)
    const saveAllPending = useCallback(async () => {
        const timeouts = saveTimeoutRef.current;
        const pendingIds = Object.keys(timeouts);
        if (!pendingIds.length) return;

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
                return;
            }
            dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId, saving: true } });
            try {
                console.log(`[AppContext] saveAllPending: ${board.title}`);
                await updateBoardFull(userId, board);
            } catch (err) {
                console.error('[AppContext] saveAllPending error:', err);
            } finally {
                activeSavesRef.current = Math.max(0, activeSavesRef.current - 1);
                if (activeSavesRef.current === 0) suppressRealtime(500);
                dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId, saving: false } });
            }
        }));
    }, [userId, suppressRealtime]);

    // Atualiza board no estado e persiste IMEDIATAMENTE (usado para Drag & Drop e mudanças estruturais)
    const updateBoardAndPersistImmediate = useCallback(async (boardId, updates) => {
        if (!boardId || !userId) return;
        dispatch({ type: 'UPDATE_BOARD', payload: { id: boardId, updates } });
        dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId, saving: true } });
        suppressRealtime(8000);
        activeSavesRef.current += 1;

        try {
            const board = stateRef.current.boards.find(b => b.id === boardId);
            if (board) {
                await updateBoardFull(userId, { ...board, ...updates });
            }
        } catch (err) {
            console.error('[AppContext] updateBoardAndPersistImmediate error:', err);
        } finally {
            activeSavesRef.current = Math.max(0, activeSavesRef.current - 1);
            if (activeSavesRef.current === 0) suppressRealtime(500);
            dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId, saving: false } });
        }
    }, [userId, suppressRealtime]);

    // Atualiza board no estado e persiste no banco imediatamente (otimizado para board específico).
    const updateBoardAndPersist = useCallback(async (boardId, updates) => {
        if (!boardId || !userId) return;
        dispatch({ type: 'UPDATE_BOARD', payload: { id: boardId, updates } });
        dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId, saving: true } });
        suppressRealtime(8000);
        activeSavesRef.current += 1;

        try {
            const updatedBoard = stateRef.current.boards.find(b => b.id === boardId);
            if (updatedBoard) {
                await updateBoardFull(userId, { ...updatedBoard, ...updates });
            }
        } catch (err) {
            console.error('[AppContext] updateBoardAndPersist error:', err);
        } finally {
            activeSavesRef.current = Math.max(0, activeSavesRef.current - 1);
            if (activeSavesRef.current === 0) suppressRealtime(500);
            dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId, saving: false } });
        }
    }, [userId, suppressRealtime]);

    // ── Realtime: subscribe to postgres_changes for cross-tab / multi-user sync ──
    useEffect(() => {
        if (!userId) return;
        // Only subscribe after the initial load is done to avoid duplicate SET_BOARDS
        // We poll until initialLoadDone.current is true (it's a ref, so not tracked by React)
        let cancelled = false;
        let realtimeChannel = null;
        let debounceTimer = null;

        const waitAndSubscribe = () => {
            if (cancelled) return;
            if (!initialLoadDone.current) {
                // Initial load not done yet — retry in 200ms
                setTimeout(waitAndSubscribe, 200);
                return;
            }

            const localKey = STORAGE_KEYS.BOARDS + '_' + userId;

            const handleChange = (payload) => {
                console.log('[AppContext] Realtime event:', payload.eventType, payload.table);
                // If THIS tab triggered this write, skip the echo to avoid overwriting
                // optimistic local state with potentially stale server data.
                if (Date.now() < realtimeSuppressUntilRef.current || activeSavesRef.current > 0) {
                    console.log('[AppContext] Realtime echo suppressed (local write in progress)');
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
                }, 350);
            };

            realtimeChannel = supabase
                .channel('dailyways-sync-' + userId.slice(0, 8))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'boards' }, handleChange)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'lists' }, handleChange)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, handleChange)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'subtasks' }, handleChange)
                .subscribe((status) => {
                    console.log('[AppContext] Realtime channel status:', status);
                });
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

    const updateBoardsOrderAndPersist = async (newBoards) => {
        if (!userId) return;
        suppressRealtime(2000);
        // Map current array order to positions
        const payloads = newBoards.map((b, i) => ({ id: b.id, position: i }));
        await updateBoardsOrder(userId, payloads);
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

    const getImportantCards = () => getAllCards().filter(c => c.priority === 'high' || c.priority === 'urgent');

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
            persistBoard,
            saveAllPending,
            suppressRealtime,
            savingBoardIds: state.savingBoardIds,
            pendingBoardIds: state.pendingBoardIds,
            showBoardToolbar: state.showBoardToolbar,
            isSavingBoard,
            hasUnsavedChanges,
            LABEL_COLORS: state.labels,
            DEFAULT_BOARD_COLORS,
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
        </AppContext.Provider>
    );
}

export const useApp = () => {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useApp must be used within AppProvider');
    return ctx;
};
