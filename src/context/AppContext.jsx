import { createContext, useContext, useReducer, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { fetchBoards, updateBoardsOrder } from '../services/boardService';
import { useAuth } from './AuthContext';
import ConfirmModal from '../components/Common/ConfirmModal';
import FloatingInvitationToast from '../components/Common/FloatingInvitationToast';
import { logger } from '../utils/logger';
import { isBoardPrankFrozen } from '../collab/board/dev/boardDevPrank.js';
import { appReducer } from './app/appReducer';
import { useBoardPersistence } from './app/useBoardPersistence';
import { useBoardsRealtime } from './app/useBoardsRealtime';
import { useInitialBoardsLoad } from './app/useInitialBoardsLoad';
import { useSmartViewCompletionStore } from '../stores/smartViewCompletionStore.js';
import { initialState, DEFAULT_BOARD_COLORS } from './app/appDefaults';
import {
    enrichCardForSmartView,
    isCardActiveImportant,
    isCardActiveMyDay,
    isCardActivePlanned,
} from '../utils/cardSmartView';

const AppContext = createContext(null);

export function AppProvider({ children }) {
    const { user } = useAuth();
    const userId = user?.id ?? null;
    // Ref do userId: atualizado sempre que o user muda (via onAuthStateChange).
    // Permite que os callbacks de save acessem o userId atual SEM chamar getSession(),
    // que pode travar durante um token refresh (o Supabase client usa lock interno).
    const userIdRef = useRef(userId);
    useEffect(() => { userIdRef.current = userId; }, [userId]);

    useEffect(() => {
        useSmartViewCompletionStore.getState().initForUser(userId);
    }, [userId]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [recentlyAddedId, setRecentlyAddedId] = useState(null);
    const [lastReorderedIds, setLastReorderedIds] = useState([]);
    const [state, rawDispatch] = useReducer(appReducer, initialState);
    const dispatch = useCallback((action) => {
        if (isBoardPrankFrozen()) return;
        rawDispatch(action);
    }, []);
    const stateRef = useRef(state);
    const initialLoadDone = useRef(false);
    const {
        saveTimeoutRef,
        realtimeSuppressUntilRef,
        activeSavesRef,
        collabActiveBoardIdRef,
        collabConnectedRef,
        collabBoardRoomLiveRef,
        setCollabActiveBoardId,
        setCollabConnectedForBoard,
        setCollabBoardRoomLive,
        suppressRealtime,
        shouldPersistBoard,
        flushBoardPersist,
        persistBoard,
        saveAllPending,
        updateBoardAndPersistImmediate,
        updateBoardAndPersist,
        retryFailedSave,
        revertFailedSave,
    } = useBoardPersistence({ userId, userIdRef, dispatch, stateRef, initialLoadDone });

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

    useInitialBoardsLoad({ userId, dispatch, initialLoadDone, saveTimeoutRef, activeSavesRef, realtimeSuppressUntilRef });

    useBoardsRealtime({ userId, dispatch, stateRef, initialLoadDone, activeSavesRef, realtimeSuppressUntilRef, collabActiveBoardIdRef, collabConnectedRef, collabBoardRoomLiveRef });

    const updateWorkspaceOrder = useCallback(async (itemType, itemId, sourceGroupId, destGroupId, destIndex) => {
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
            logger.error('[AppContext] Error updating order:', err);
        } finally {
            dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId: '__workspace_order__', saving: false } });
        }
    }, [userId, suppressRealtime]);

    // Helpers (estáveis enquanto os boards não mudam → o value do contexto pode ser memoizado)
    const { boards, activeBoard } = state;
    const getActiveBoard = useCallback(() => boards.find(b => b.id === activeBoard), [boards, activeBoard]);

    // Lista achatada de cards: calculada uma vez por mudança de boards (antes era a cada chamada).
    const allCards = useMemo(() => {
        const cards = [];
        boards.forEach(board => {
            board.lists.forEach(list => {
                list.cards.forEach(card => {
                    cards.push(enrichCardForSmartView(card, board, list));
                });
            });
        });
        return cards;
    }, [boards]);
    const getAllCards = useCallback(() => allCards.slice(), [allCards]);

    /** Pendentes no Meu Dia (badges, foco, sugestões). */
    const getMyDayCards = useCallback(() => allCards.filter(isCardActiveMyDay), [allCards]);

    /** Todas as missões do dia, inclusive concluídas (progresso no hub). */
    const getMyDayCardsAll = useCallback(() => allCards.filter(c => c.myDay), [allCards]);

    const getImportantCards = useCallback(() => allCards.filter(isCardActiveImportant), [allCards]);

    const getPlannedCards = useCallback(() => allCards.filter(isCardActivePlanned), [allCards]);

    const searchCards = useCallback((query) => {
        if (!query) return [];
        const q = query.toLowerCase();
        return allCards.filter(c =>
            c.title.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)
        );
    }, [allCards]);

    // ── Unified Confirm Modal ──
    const showConfirm = useCallback(({ title, message, type = 'danger', confirmLabel, cancelLabel, checkbox }) => {
        return new Promise((resolve) => {
            dispatch({
                type: 'SHOW_CONFIRM',
                payload: {
                    title,
                    message,
                    type,
                    confirmLabel,
                    cancelLabel,
                    checkbox: checkbox ?? null,
                    onConfirm: (checkboxChecked) => {
                        dispatch({ type: 'HIDE_CONFIRM' });
                        if (checkbox) {
                            resolve({ permanent: !!checkboxChecked });
                        } else {
                            resolve(true);
                        }
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

    // Recarrega boards do servidor (usado após aceitar convite de compartilhamento)
    const reloadBoards = useCallback(async () => {
        if (!userId) return;
        const { data: fromDb, error } = await fetchBoards(userId);
        if (error) {
            dispatch({ type: 'SET_BOARDS_LOAD_ERROR', payload: error });
            return;
        }
        dispatch({ type: 'SET_BOARDS_LOAD_ERROR', payload: null });
        if (fromDb) {
            dispatch({ type: 'SET_BOARDS', payload: fromDb });
        }
    }, [userId]);

    const contextValue = useMemo(() => ({
        state,
        dispatch,
        getActiveBoard,
        getAllCards,
        getMyDayCards,
        getMyDayCardsAll,
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
        flushBoardPersist,
        saveAllPending,
        suppressRealtime,
        savingBoardIds: state.savingBoardIds,
        pendingBoardIds: state.pendingBoardIds,
        saveErrors: state.saveErrors,
        retryFailedSave,
        revertFailedSave,
        showBoardToolbar: state.showBoardToolbar,
        profileMenuOpen: state.profileMenuOpen,
        boardsLoadError: state.boardsLoadError,
        isSavingBoard,
        hasUnsavedChanges,
        LABEL_COLORS: state.labels,
        DEFAULT_BOARD_COLORS,
        updateWorkspaceOrder,
        reloadBoards,
        setCollabActiveBoardId,
        setCollabConnectedForBoard,
        setCollabBoardRoomLive,
        shouldPersistBoard,
    }), [
        confirmConfig,
        dispatch,
        flushBoardPersist,
        getActiveBoard,
        getAllCards,
        getImportantCards,
        getMyDayCards,
        getMyDayCardsAll,
        getPlannedCards,
        hasUnsavedChanges,
        isSavingBoard,
        isSidebarOpen,
        lastReorderedIds,
        persistBoard,
        recentlyAddedId,
        reloadBoards,
        retryFailedSave,
        revertFailedSave,
        saveAllPending,
        searchCards,
        setCollabActiveBoardId,
        setCollabBoardRoomLive,
        setCollabConnectedForBoard,
        setIsSidebarOpen,
        setLastReorderedIds,
        setRecentlyAddedId,
        shouldPersistBoard,
        showConfirm,
        state,
        suppressRealtime,
        updateBoardAndPersist,
        updateBoardAndPersistImmediate,
        updateWorkspaceOrder,
    ]);

    return (
        <AppContext.Provider value={contextValue}>
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
                checkbox={state.confirmModal.checkbox}
            />
            {/* Painel flutuante de convite */}
            <FloatingInvitationToast />
        </AppContext.Provider>
    );
}

export const useApp = () => {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useApp must be used within AppProvider');
    return ctx;
};
