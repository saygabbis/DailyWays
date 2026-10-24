/** Ações da sidebar: criar/renomear/duplicar/apagar boards, spaces e pastas, seleção em massa e menus de contexto. */
import { insertBoardFull } from '../../services/boardService';
import './Sidebar.css';
import { uuidv4 } from '../../utils/uuid';
import { useSidebarContextMenus } from './useSidebarContextMenus';

export function useSidebarActions(ctx) {
    const {
        onViewChange,
        onClose,
        isDesktop,
        user,
        logout,
        boardCollab,
        state,
        dispatch,
        DEFAULT_BOARD_COLORS,
        suppressRealtime,
        showConfirm,
        reloadBoards,
        setLastReorderedIds,
        t,
        showContextMenu,
        setShowNewBoard,
        newBoardTitle,
        setNewBoardTitle,
        setShowNewSpace,
        newSpaceTitle,
        setNewSpaceTitle,
        setShowNewFolder,
        newFolderTitle,
        setNewFolderTitle,
        folderContextType,
        setEditingBoardId,
        editBoardTitle,
        setEditBoardTitle,
        setEditingGroupId,
        editGroupTitle,
        setEditGroupTitle,
        setRecentlyAddedId,
        setGroupDetailsOpen,
        setGroupDetailsTarget,
        setDetailsBoard,
        setDetailsSpace,
    } = ctx;

    const handleAddBoard = async (e) => {
        e.preventDefault();
        if (!newBoardTitle.trim()) return;

        // Criar o board com IDs definitivos (mesmo id que vai ao Supabase)
        const newBoard = {
            id: uuidv4(),
            ownerId: user.id,
            title: newBoardTitle.trim(),
            color: DEFAULT_BOARD_COLORS[Math.floor(Math.random() * DEFAULT_BOARD_COLORS.length)],
            emoji: '📋',
            createdAt: new Date().toISOString(),
            lists: [
                { id: uuidv4(), title: 'A Fazer', color: null, isCompletionList: false, cards: [] },
                { id: uuidv4(), title: 'Em Progresso', color: null, isCompletionList: false, cards: [] },
                { id: uuidv4(), title: 'Concluído', color: null, isCompletionList: true, cards: [] },
            ],
        };

        // Estado local imediato (otimismo) — ADD_BOARD usará o mesmo id e listas
        dispatch({ type: 'ADD_BOARD', payload: newBoard });
        dispatch({ type: 'SET_ACTIVE_BOARD', payload: newBoard.id });
        setRecentlyAddedId(newBoard.id);
        setTimeout(() => setRecentlyAddedId(null), 700);
        setNewBoardTitle('');
        setShowNewBoard(false);
        onViewChange('board', newBoard.id);

        // Ativa o floating save durante a operação no servidor
        dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId: '__board_ops__', saving: true } });
        if (suppressRealtime) suppressRealtime(3000);
        try {
            await insertBoardFull(user.id, { ...newBoard, position: state.boards.length });
        } finally {
            dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId: '__board_ops__', saving: false } });
        }
    };

    const handleAddFolder = async (e) => {
        if (e) e.preventDefault();
        if (!newFolderTitle.trim()) return;

        const newGroup = {
            id: uuidv4(),
            title: newFolderTitle.trim(),
            type: folderContextType,
            position: 0,
            isExpanded: false
        };

        // Shift existing groups of the same type down by 1
        state.groups.filter(g => g.type === folderContextType).forEach(g => {
            dispatch({ type: 'UPDATE_GROUP', payload: { id: g.id, updates: { position: g.position + 1 } } });
        });

        dispatch({ type: 'ADD_GROUP', payload: newGroup });
        setRecentlyAddedId(newGroup.id);
        setTimeout(() => setRecentlyAddedId(null), 600);

        // If there are selected items of the same type, move them into this new folder
        const selectedSnap = state.selectedItems?.length > 0 && state.selectionType === folderContextType ? [...state.selectedItems] : null;
        if (selectedSnap) {
            selectedSnap.forEach(itemId => {
                dispatch({
                    type: 'MOVE_WORKSPACE_ITEM',
                    payload: { itemType: folderContextType + 's', itemIds: [itemId], destGroupId: newGroup.id, destIndex: 0 }
                });
            });
            dispatch({ type: 'CLEAR_SELECTION' });
        }

        setNewFolderTitle('');
        setShowNewFolder(false);

        dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId: '__folder_ops__', saving: true } });
        if (suppressRealtime) suppressRealtime(3000);
        try {
            const { insertGroup, updateEntitiesOrder } = await import('../../services/workspaceService');
            await insertGroup(user.id, newGroup);

            // If we moved items, sync their order to backend
            if (selectedSnap) {
                const updatedItems = selectedSnap.map(itemId => ({ id: itemId, groupId: newGroup.id, position: 0 }));
                await updateEntitiesOrder(folderContextType + 's', updatedItems);
            }
        } finally {
            dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId: '__folder_ops__', saving: false } });
        }
    };

    const handleStartGroupRename = (group) => {
        setEditingGroupId(group.id);
        setEditGroupTitle(group.title);
    };

    const handleGroupRenameSubmit = async (groupId) => {
        setEditingGroupId(null);
        if (!groupId) return; // Escape pressed
        const titleToSave = editGroupTitle.trim();
        if (!titleToSave) return;

        dispatch({ type: 'UPDATE_GROUP', payload: { id: groupId, updates: { title: titleToSave } } });
        dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId: '__folder_ops__', saving: true } });
        if (suppressRealtime) suppressRealtime(2000);
        try {
            const { updateGroup } = await import('../../services/workspaceService');
            await updateGroup(groupId, { title: titleToSave });
        } finally {
            dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId: '__folder_ops__', saving: false } });
        }
    };

    const handleGroupExpandToggle = async (g) => {
        const newExpanded = !g.isExpanded;
        dispatch({ type: 'UPDATE_GROUP', payload: { id: g.id, updates: { isExpanded: newExpanded } } });
        if (suppressRealtime) suppressRealtime(2000);
        try {
            const { updateGroup } = await import('../../services/workspaceService');
            await updateGroup(g.id, { isExpanded: newExpanded });
        } catch (err) {
            console.error('Failed to update group expanded state', err);
        }
    };

    const handleGroupHeaderClick = (e, g) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            dispatch({ type: 'TOGGLE_SELECTION', payload: { id: g.id, type: 'group' } });
            return;
        }
        handleGroupExpandToggle(g);
    };

    const handleAddSpace = async (e) => {
        if (e) e.preventDefault();
        if (!newSpaceTitle.trim()) return;

        const newSpace = {
            id: uuidv4(),
            title: newSpaceTitle.trim(),
            color: DEFAULT_BOARD_COLORS[Math.floor(Math.random() * DEFAULT_BOARD_COLORS.length)],
            emoji: '🌌',
            position: state.spaces.length,
            groupId: null,
            ownerId: user.id,
            panX: 0,
            panY: 0,
            zoom: 1,
            createdAt: new Date().toISOString(),
        };

        dispatch({ type: 'ADD_SPACE', payload: newSpace });
        setRecentlyAddedId(newSpace.id);
        setTimeout(() => setRecentlyAddedId(null), 700);
        setNewSpaceTitle('');
        setShowNewSpace(false);
        onViewChange('space');
        // Actually the active view logic for spaces might need to set activeSpace?
        // We'll manage active space ID via AppContext later...

        const { insertSpace } = await import('../../services/workspaceService');
        await insertSpace(user.id, newSpace);
    };

    const handleBoardClick = (e, boardId) => {
        if (e && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            dispatch({ type: 'TOGGLE_SELECTION', payload: { id: boardId, type: 'board' } });
            return;
        }
        if (state.selectedItems?.length > 0) {
            dispatch({ type: 'CLEAR_SELECTION' });
        }
        dispatch({ type: 'SET_ACTIVE_BOARD', payload: boardId });
        onViewChange('board', boardId);
        if (!isDesktop) onClose?.();
    };

    const handleSpaceClick = (e, spaceId) => {
        if (e && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            dispatch({ type: 'TOGGLE_SELECTION', payload: { id: spaceId, type: 'space' } });
            return;
        }
        if (state.selectedItems?.length > 0) {
            dispatch({ type: 'CLEAR_SELECTION' });
        }
        onViewChange(`space-${spaceId}`);
        if (!isDesktop) onClose?.();
    };

    const handleNavClick = (viewId) => {
        onViewChange(viewId);
        if (!isDesktop) onClose?.();
    };

    const handleLogout = async () => {
        const confirmed = await showConfirm({
            title: t.logoutConfirmTitle,
            message: t.logoutConfirmMsg,
            confirmLabel: t.logoutConfirmBtn,
            cancelLabel: t.logoutCancelBtn,
            type: 'danger'
        });
        if (confirmed) logout();
    };

    const handleDuplicateSelected = async (itemType) => {
        const count = state.selectedItems?.length;
        if (!count) return;

        dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId: '__bulk_ops__', saving: true } });
        try {
            const itemsToDup = [...state.selectedItems];
            if (itemType === 'board') {
                const boards = state.boards.filter(b => itemsToDup.includes(b.id));
                for (const b of boards) {
                    const dup = {
                        ...JSON.parse(JSON.stringify(b)),
                        id: uuidv4(),
                        ownerId: user.id,
                        title: `${b.title} (cópia)`,
                        createdAt: new Date().toISOString(),
                        lists: b.lists.map(l => ({
                            ...l,
                            id: uuidv4(),
                            cards: l.cards.map(c => ({
                                ...c,
                                id: uuidv4(),
                                subtasks: (c.subtasks || []).map(st => ({ ...st, id: uuidv4() })),
                            })),
                        })),
                    };
                    dispatch({ type: 'ADD_BOARD', payload: dup });
                    await insertBoardFull(user.id, { ...dup, position: state.boards.length + 1 });
                }
            } else if (itemType === 'space') {
                const { insertSpace } = await import('../../services/workspaceService');
                const spaces = state.spaces.filter(s => itemsToDup.includes(s.id));
                for (const s of spaces) {
                    const dup = {
                        ...JSON.parse(JSON.stringify(s)),
                        id: uuidv4(),
                        title: `${s.title} (cópia)`,
                        createdAt: new Date().toISOString(),
                        position: state.spaces.length
                    };
                    dispatch({ type: 'ADD_SPACE', payload: dup });
                    await insertSpace(user.id, dup);
                }
            } else if (itemType === 'group') {
                // Duplicate each selected folder with its contents
                for (const gid of itemsToDup) {
                    const group = state.groups.find(g => g.id === gid);
                    if (group) await handleDuplicateGroup(group);
                }
            }
            dispatch({ type: 'CLEAR_SELECTION' });
        } catch (err) {
            console.error('Failed to duplicate selected items', err);
        } finally {
            dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId: '__bulk_ops__', saving: false } });
        }
    };

    const handleDuplicateGroup = async (group) => {
        dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId: '__folder_ops__', saving: true } });
        try {
            const { insertGroup, insertSpace } = await import('../../services/workspaceService');
            const newGroupId = uuidv4();
            const newGroup = {
                ...JSON.parse(JSON.stringify(group)),
                id: newGroupId,
                title: `${group.title} (cópia)`,
                createdAt: new Date().toISOString(),
                isExpanded: group.isExpanded,
                type: group.type,
                position: state.groups.filter(g => g.type === group.type).length
            };

            dispatch({ type: 'ADD_GROUP', payload: newGroup });
            await insertGroup(user.id, newGroup);

            if (group.type === 'board') {
                const groupBoards = state.boards.filter(b => b.groupId === group.id);
                for (const b of groupBoards) {
                    const dup = {
                        ...JSON.parse(JSON.stringify(b)),
                        id: uuidv4(),
                        ownerId: user.id,
                        groupId: newGroupId,
                        title: b.title,
                        createdAt: new Date().toISOString(),
                        lists: b.lists.map(l => ({
                            ...l,
                            id: uuidv4(),
                            cards: l.cards.map(c => ({
                                ...c,
                                id: uuidv4(),
                                subtasks: (c.subtasks || []).map(st => ({ ...st, id: uuidv4() })),
                            })),
                        })),
                    };
                    dispatch({ type: 'ADD_BOARD', payload: dup });
                    await insertBoardFull(user.id, { ...dup, position: state.boards.length + 1 });
                }
            } else if (group.type === 'space') {
                const groupSpaces = state.spaces.filter(s => s.groupId === group.id);
                for (const s of groupSpaces) {
                    const dup = {
                        ...JSON.parse(JSON.stringify(s)),
                        id: uuidv4(),
                        groupId: newGroupId,
                        createdAt: new Date().toISOString()
                    };
                    dispatch({ type: 'ADD_SPACE', payload: dup });
                    await insertSpace(user.id, dup);
                }
            }
        } catch (err) {
            console.error('Failed to duplicate group', err);
        } finally {
            dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId: '__folder_ops__', saving: false } });
        }
    };

    const handleStartRename = (board) => {
        setEditingBoardId(board.id);
        setEditBoardTitle(board.title);
    };

    const handleRenameSubmit = async (e, boardId) => {
        if (e) e.preventDefault();
        const titleToSave = editBoardTitle.trim();
        setEditingBoardId(null); // Close UI immediately

        if (titleToSave) {
            boardCollab?.collabDispatchForBoard(boardId, {
                type: 'UPDATE_BOARD',
                payload: { id: boardId, updates: { title: titleToSave } },
            });
        }
    };

    const {
        handleGroupCheckboxClick,
        handleSpaceContextMenu,
        handleGroupContextMenu,
        handleBoardContextMenu,
    } = useSidebarContextMenus({
        onViewChange,
        user,
        state,
        dispatch,
        suppressRealtime,
        showConfirm,
        reloadBoards,
        setLastReorderedIds,
        showContextMenu,
        setGroupDetailsOpen,
        setGroupDetailsTarget,
        setDetailsBoard,
        setDetailsSpace,
        handleStartGroupRename,
        handleDuplicateSelected,
        handleDuplicateGroup,
        handleStartRename,
    });


    return {
        handleAddBoard,
        handleAddFolder,
        handleStartGroupRename,
        handleGroupRenameSubmit,
        handleGroupExpandToggle,
        handleGroupHeaderClick,
        handleAddSpace,
        handleBoardClick,
        handleSpaceClick,
        handleNavClick,
        handleLogout,
        handleStartRename,
        handleRenameSubmit,
        handleGroupCheckboxClick,
        handleSpaceContextMenu,
        handleGroupContextMenu,
        handleBoardContextMenu,
    };
}
