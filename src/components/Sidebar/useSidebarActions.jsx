/** Ações da sidebar: criar/renomear/duplicar/apagar boards, spaces e pastas, seleção em massa e menus de contexto. */
import { insertBoardFull, deleteBoard, removeMember, isBoardOwnerClient } from '../../services/boardService';
import { Edit3, Trash2, Copy, LayoutDashboard, MoreHorizontal, Settings2 } from 'lucide-react';
import './Sidebar.css';
import { uuidv4 } from '../../utils/uuid';

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

    // Board context menu
    const getBoardContextItems = (board) => [
        {
            label: 'Detalhes',
            icon: <MoreHorizontal size={15} />,
            action: () => setDetailsBoard(board),
        },
        {
            label: 'Renomear',
            icon: <Edit3 size={15} />,
            action: () => handleStartRename(board),
        },
        {
            label: 'Duplicar',
            icon: <Copy size={15} />,
            action: async () => {
                // Gerar todos os IDs novos antes, assim dispatch e Supabase usam os MESMOS IDs
                const dup = {
                    ...JSON.parse(JSON.stringify(board)),
                    id: uuidv4(),
                    ownerId: user.id,
                    title: `${board.title} (cópia)`,
                    createdAt: new Date().toISOString(),
                    lists: board.lists.map(l => ({
                        ...l,
                        id: uuidv4(),
                        cards: l.cards.map(c => ({
                            ...c,
                            id: uuidv4(),
                            subtasks: (c.subtasks || []).map(st => ({ ...st, id: uuidv4() })),
                        })),
                    })),
                };
                // ADD_BOARD com os IDs já definidos (não gera novos IDs internamente)
                dispatch({ type: 'ADD_BOARD', payload: dup });
                // SET_ACTIVE_BOARD persiste o id no localStorage (ADD_BOARD não faz isso)
                dispatch({ type: 'SET_ACTIVE_BOARD', payload: dup.id });
                if (suppressRealtime) suppressRealtime(3000);
                // Ativa o floating save durante a operação no servidor
                dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId: '__board_ops__', saving: true } });
                try {
                    await insertBoardFull(user.id, { ...dup, position: state.boards.length + 1 });
                } finally {
                    dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId: '__board_ops__', saving: false } });
                }
            },
        },
        { type: 'divider' },
        {
            label: isBoardOwnerClient(board, user.id) ? 'Deletar board' : 'Sair do board',
            icon: <Trash2 size={15} />,
            danger: true,
            action: async () => {
                const isOwner = isBoardOwnerClient(board, user.id);
                const confirmed = await showConfirm({
                    title: isOwner ? 'Deletar board' : 'Sair do board',
                    message: isOwner
                        ? `Tem certeza que deseja deletar o board "${board.title}"? Esta ação não pode ser desfeita.`
                        : `O board "${board.title}" não será apagado — só deixas de o ver na tua lista e sais dos membros.`,
                    confirmLabel: isOwner ? 'Deletar' : 'Sair',
                    cancelLabel: 'Cancelar',
                    type: 'danger'
                });
                if (!confirmed) return;

                dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId: '__board_ops__', saving: true } });
                if (suppressRealtime) suppressRealtime(3000);
                let serverOk = false;
                try {
                    const result = isOwner
                        ? await deleteBoard(board.id)
                        : await removeMember(board.id, user.id);
                    serverOk = result.success;
                    if (!serverOk) {
                        await reloadBoards();
                        await showConfirm({
                            title: isOwner ? 'Não foi possível apagar' : 'Não foi possível sair',
                            message: result.error || 'Tenta novamente.',
                            type: 'info',
                            confirmLabel: 'OK',
                            cancelLabel: 'Fechar',
                        });
                        return;
                    }
                } finally {
                    dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId: '__board_ops__', saving: false } });
                }

                const isActive = state.activeBoard === board.id;
                const boardIndex = state.boards.findIndex(b => b.id === board.id);
                const groupId = board.groupId;
                const wasOnlyBoardInGroup = groupId && state.boards.filter(b => b.groupId === groupId).length === 1;

                dispatch({ type: 'DELETE_BOARD', payload: board.id });

                if (wasOnlyBoardInGroup) {
                    try {
                        const { updateGroup } = await import('../../services/workspaceService');
                        await updateGroup(groupId, { isExpanded: false });
                    } catch (e) { /* ignore */ }
                }

                if (isActive) {
                    const remaining = state.boards.filter(b => b.id !== board.id);
                    if (remaining.length > 0) {
                        const next = remaining[boardIndex] ?? remaining[boardIndex - 1];
                        dispatch({ type: 'SET_ACTIVE_BOARD', payload: next.id });
                        onViewChange('board', next.id);
                    } else {
                        onViewChange('dashboard');
                    }
                }
            },
        },
    ];

    const handleGroupCheckboxClick = (e, group, groupItems) => {
        e.stopPropagation();
        const ids = groupItems.map(i => i.id);
        const itemType = group.type; // 'board' or 'space'
        const currentSelected = state.selectedItems || [];

        if (!group.isExpanded || ids.length === 0) {
            // Closed folder OR empty open folder: add/remove from selection
            const isAlreadySelected = currentSelected.includes(group.id);
            if (isAlreadySelected) {
                // Remove this folder from the selection
                const newItems = currentSelected.filter(id => id !== group.id);
                if (newItems.length === 0) {
                    dispatch({ type: 'CLEAR_SELECTION' });
                } else {
                    dispatch({ type: 'SET_SELECTION', payload: { type: state.selectionType || 'group', items: newItems } });
                }
            } else {
                // Check if current selection already has group IDs (2nd-click state)
                // Only append if selecting folders or if no active selection
                const hasGroupsInSelection = currentSelected.some(id =>
                    (state.groups || []).some(g => g.id === id)
                );
                if (currentSelected.length === 0 || hasGroupsInSelection) {
                    // Append: no selection yet or already selecting folders
                    dispatch({ type: 'SET_SELECTION', payload: { type: 'group', items: [...currentSelected, group.id] } });
                } else {
                    // Current selection is pure content items (1st-click / dash state)
                    // Start fresh with just this folder
                    dispatch({ type: 'SET_SELECTION', payload: { type: 'group', items: [group.id] } });
                }
            }
        } else {
            // Open folder with items
            const allItemsSelected = ids.length > 0 && ids.every(id => currentSelected.includes(id)) && state.selectionType === itemType;
            const isGroupAlsoSelected = currentSelected.includes(group.id);

            if (!allItemsSelected) {
                // 1st click: select all contents only (not the folder)
                dispatch({ type: 'SET_SELECTION', payload: { type: itemType, items: ids } });
            } else if (!isGroupAlsoSelected) {
                // 2nd click: also select the folder itself
                // Keep the type as itemType so bulk drag still works for items
                dispatch({ type: 'SET_SELECTION', payload: { type: itemType, items: [...ids, group.id] } });
            } else {
                // 3rd click: clear everything
                dispatch({ type: 'CLEAR_SELECTION' });
            }
        }
    };

    const handleBulkContextMenu = (e, itemType) => {
        const count = state.selectedItems.length;
        const labelStr = itemType === 'board' ? 'boards selecionados' : itemType === 'group' ? 'pastas selecionadas' : 'spaces selecionados';

        const items = [
            {
                label: `Limpar Seleção`,
                icon: <LayoutDashboard size={15} />,
                action: () => dispatch({ type: 'CLEAR_SELECTION' })
            },
            { type: 'divider' },
            {
                label: `Apagar Selecionados`,
                icon: <Trash2 size={15} color="var(--danger)" />,
                danger: true,
                action: async () => {
                    const confirmed = await showConfirm({
                        title: 'Apagar Itens Selecionados',
                        message: `Tem certeza que deseja apagar ${count} ${labelStr}? Isso não pode ser desfeito.`,
                        confirmLabel: 'Apagar Todos',
                        type: 'danger'
                    });
                    if (confirmed) {
                        const itemsToDelete = [...state.selectedItems];
                        dispatch({ type: 'DELETE_SELECTED_ITEMS' });
                        if (suppressRealtime) suppressRealtime(5000);

                        try {
                            if (itemType === 'board') {
                                const { deleteBoard } = await import('../../services/boardService');
                                for (const id of itemsToDelete) {
                                    const b = state.boards.find(x => x.id === id);
                                    const isOwner = isBoardOwnerClient(b, user.id);
                                    const result = isOwner
                                        ? await deleteBoard(id)
                                        : await removeMember(id, user.id);
                                    if (!result.success) {
                                        await reloadBoards();
                                        await showConfirm({
                                            title: 'Operação incompleta',
                                            message: result.error || 'Alguns boards não foram atualizados. A lista foi sincronizada.',
                                            type: 'info',
                                            confirmLabel: 'OK',
                                            cancelLabel: 'Fechar',
                                        });
                                        break;
                                    }
                                }
                            } else if (itemType === 'space') {
                                const { deleteSpace } = await import('../../services/workspaceService');
                                for (const id of itemsToDelete) await deleteSpace(id);
                            } else if (itemType === 'group') {
                                const { deleteGroup } = await import('../../services/workspaceService');
                                for (const id of itemsToDelete) await deleteGroup(id);
                            }
                        } catch (err) {
                            console.error('Falha ao apagar itens em massa', err);
                        }
                    }
                }
            },
            {
                label: `Duplicar Selecionados`,
                icon: <Edit3 size={15} />,
                action: () => handleDuplicateSelected(itemType)
            }
        ];

        if (itemType === 'group') {
            // Check if ALL selected folders are empty
            const allEmpty = state.selectedItems.every(gid => {
                const groupType = state.groups.find(g => g.id === gid)?.type;
                if (!groupType) return true;
                const entities = groupType === 'board' ? state.boards : state.spaces;
                return entities.filter(i => i.groupId === gid).length === 0;
            });

            if (allEmpty) {
                // All folders empty: single red delete button (replace the generic one)
                items[2].label = 'Apagar Pastas';
            } else {
                // Some folders have items: show both options
                items.push({
                    label: `Apagar Pastas (Manter Itens)`,
                    icon: <Trash2 size={15} />,
                    action: async () => {
                        const confirmed = await showConfirm({
                            title: 'Apagar Pastas',
                            message: `Você apagará ${count} pastas, mas os itens serão movidos para raiz.`,
                            confirmLabel: 'Confirmar'
                        });
                        if (confirmed) {
                            const itemsToDelete = [...state.selectedItems];

                            // Move items out
                            itemsToDelete.forEach(gid => {
                                const groupType = state.groups.find(g => g.id === gid)?.type;
                                if (!groupType) return;
                                const entities = groupType === 'board' ? state.boards : state.spaces;
                                const groupItems = entities.filter(i => i.groupId === gid);
                                groupItems.forEach(i => {
                                    dispatch({ type: 'MOVE_WORKSPACE_ITEM', payload: { itemType: groupType + 's', itemIds: [i.id], destGroupId: null, destIndex: 0 } });
                                });
                            });

                            dispatch({ type: 'DELETE_SELECTED_ITEMS' });
                            if (suppressRealtime) suppressRealtime(5000);
                            try {
                                const { deleteGroup } = await import('../../services/workspaceService');
                                for (const id of itemsToDelete) await deleteGroup(id);
                            } catch (e) { }
                        }
                    }
                });
                // Tweak the text of the existing delete option for groups
                items[2].label = 'Apagar Tudo (Pastas + Itens)';
                items[2].action = async () => {
                    const confirmed = await showConfirm({
                        title: 'Apagar Tudo',
                        message: `Tudo dentro de ${count} pastas será apagado PERMANENTEMENTE.`,
                        confirmLabel: 'Apagar Tudo',
                        type: 'danger'
                    });
                    if (confirmed) {
                        const itemsToDelete = [...state.selectedItems];

                        itemsToDelete.forEach(gid => {
                            const groupType = state.groups.find(g => g.id === gid)?.type;
                            if (!groupType) return;
                            const entities = groupType === 'board' ? state.boards : state.spaces;
                            const groupItems = entities.filter(i => i.groupId === gid);
                            groupItems.forEach(i => {
                                dispatch({ type: groupType === 'board' ? 'DELETE_BOARD' : 'DELETE_SPACE', payload: i.id });
                            });
                        });

                        dispatch({ type: 'DELETE_SELECTED_ITEMS' });
                        if (suppressRealtime) suppressRealtime(5000);
                        try {
                            const { deleteGroup } = await import('../../services/workspaceService');
                            for (const id of itemsToDelete) await deleteGroup(id);
                        } catch (e) { }
                    }
                };
            }
        }

        showContextMenu(e, items, { title: `${count} Selecionados` });
    };

    const handleSpaceContextMenu = (e, space) => {
        if (state.selectedItems?.length > 1 && state.selectedItems.includes(space.id)) {
            return handleBulkContextMenu(e, 'space');
        }
        showContextMenu(e, [
            {
                label: 'Detalhes',
                icon: <MoreHorizontal size={15} />,
                action: () => setDetailsSpace(space),
            },
            {
                label: 'Renomear',
                icon: <Edit3 size={15} />,
                action: () => alert('Opcão em desenvolvimento.'),
            },
            { type: 'divider' },
            {
                label: 'Deletar Space',
                icon: <Trash2 size={15} />,
                danger: true,
                action: async () => {
                    const confirmed = await showConfirm({
                        title: 'Deletar Space',
                        message: `Tem certeza que deseja deletar o space "${space.title}"?`,
                        confirmLabel: 'Deletar',
                        type: 'danger'
                    });
                    if (confirmed) {
                        const groupId = space.groupId;
                        const wasOnlySpaceInGroup = groupId && state.spaces.filter(s => s.groupId === groupId).length === 1;
                        dispatch({ type: 'DELETE_SPACE', payload: space.id });
                        if (suppressRealtime) suppressRealtime(3000);
                        const { deleteSpace, updateGroup } = await import('../../services/workspaceService');
                        await deleteSpace(space.id);
                        if (wasOnlySpaceInGroup) {
                            try { await updateGroup(groupId, { isExpanded: false }); } catch (e) { /* ignore */ }
                        }
                    }
                },
            },
        ], { title: space.title });
    };

    const handleGroupContextMenu = (e, group) => {
        if (state.selectedItems?.length > 1 && state.selectedItems.includes(group.id)) {
            return handleBulkContextMenu(e, 'group');
        }
        const items = group.type === 'board' ? state.boards : state.spaces;
        const groupItems = items.filter(i => i.groupId === group.id);
        const isEmpty = groupItems.length === 0;

        const menuItems = [
            {
                label: 'Renomear Pasta',
                icon: <Edit3 size={15} />,
                action: () => handleStartGroupRename(group),
            },
            {
                label: 'Duplicar Pasta',
                icon: <Edit3 size={15} />,
                action: () => handleDuplicateGroup(group)
            },
            { type: 'divider' },
        ];

        if (isEmpty) {
            menuItems.push({
                label: 'Apagar Pasta',
                icon: <Trash2 size={15} color="var(--danger)" />,
                danger: true,
                action: async () => {
                    const confirmed = await showConfirm({
                        title: 'Apagar Pasta',
                        message: `Tem certeza que deseja apagar a pasta "${group.title}"?`,
                        confirmLabel: 'Apagar',
                        type: 'danger'
                    });
                    if (confirmed) {
                        dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId: '__folder_ops__', saving: true } });
                        try {
                            const { deleteGroup } = await import('../../services/workspaceService');
                            dispatch({ type: 'DELETE_GROUP', payload: group.id });
                            if (suppressRealtime) suppressRealtime(3000);
                            await deleteGroup(group.id);
                        } catch (err) {
                            console.error('Failed to delete group', err);
                        } finally {
                            dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId: '__folder_ops__', saving: false } });
                        }
                    }
                },
            });
        } else {
            menuItems.push(
                {
                    label: 'Apagar Pasta (Manter Itens)',
                    icon: <Trash2 size={15} />,
                    action: async () => {
                        const confirmed = await showConfirm({
                            title: 'Apagar Pasta',
                            message: `A pasta "${group.title}" será apagada, mas os itens serão movidos para fora.`,
                            confirmLabel: 'Confirmar'
                        });
                        if (confirmed) {
                            try {
                                const { deleteGroup } = await import('../../services/workspaceService');
                                const idsKept = groupItems.map(i => i.id);
                                groupItems.forEach(i => {
                                    dispatch({ type: 'MOVE_WORKSPACE_ITEM', payload: { itemType: group.type + 's', itemIds: [i.id], sourceGroupId: group.id, destGroupId: null, destIndex: 0 } });
                                });

                                dispatch({ type: 'DELETE_GROUP', payload: group.id });
                                if (idsKept.length > 0 && setLastReorderedIds) {
                                    setLastReorderedIds(idsKept);
                                    setTimeout(() => setLastReorderedIds([]), 650);
                                }
                                dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId: '__folder_ops__', saving: true } });
                                if (suppressRealtime) suppressRealtime(3000);
                                await deleteGroup(group.id);
                            } catch (err) {
                                console.error('Failed to delete group', err);
                            } finally {
                                dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId: '__folder_ops__', saving: false } });
                            }
                        }
                    },
                },
                {
                    label: 'Apagar Tudo (Pasta + Itens)',
                    icon: <Trash2 size={15} color="var(--danger)" />,
                    danger: true,
                    action: async () => {
                        const confirmed = await showConfirm({
                            title: 'Apagar Pasta e Itens',
                            message: `Tudo dentro de "${group.title}" será apagado PERMANENTEMENTE.`,
                            confirmLabel: 'Apagar Tudo',
                            type: 'danger'
                        });
                        if (confirmed) {
                            dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId: '__folder_ops__', saving: true } });
                            try {
                                const { deleteGroup } = await import('../../services/workspaceService');
                                dispatch({ type: 'DELETE_GROUP', payload: group.id });

                                const boardIdsToDelete = [];
                                const spaceIdsToDelete = [];

                                for (const i of groupItems) {
                                    if (group.type === 'board') {
                                        dispatch({ type: 'DELETE_BOARD', payload: i.id });
                                        boardIdsToDelete.push(i.id);
                                    }
                                    if (group.type === 'space') {
                                        dispatch({ type: 'DELETE_SPACE', payload: i.id });
                                        spaceIdsToDelete.push(i.id);
                                    }
                                }

                                if (suppressRealtime) suppressRealtime(3000);
                                await deleteGroup(group.id);

                                if (boardIdsToDelete.length > 0) {
                                    const { deleteBoard } = await import('../../services/boardService');
                                    for (const id of boardIdsToDelete) {
                                        const b = state.boards.find(x => x.id === id);
                                        const isOwner = isBoardOwnerClient(b, user.id);
                                        const result = isOwner
                                            ? await deleteBoard(id)
                                            : await removeMember(id, user.id);
                                        if (!result.success) {
                                            await reloadBoards();
                                            await showConfirm({
                                                title: 'Operação incompleta',
                                                message: result.error || 'Alguns boards não foram atualizados.',
                                                type: 'info',
                                                confirmLabel: 'OK',
                                                cancelLabel: 'Fechar',
                                            });
                                            break;
                                        }
                                    }
                                }
                                if (spaceIdsToDelete.length > 0) {
                                    const { deleteSpace } = await import('../../services/workspaceService');
                                    for (const id of spaceIdsToDelete) await deleteSpace(id);
                                }

                            } catch (err) {
                                console.error('Failed to delete group', err);
                            } finally {
                                dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId: '__folder_ops__', saving: false } });
                            }
                        }
                    },
                }
            );
        }

        // Add details entry (cor/ícone)
        menuItems.unshift({
            label: 'Detalhes da pasta',
            icon: <Settings2 size={15} />,
            action: () => {
                setGroupDetailsTarget(group);
                setGroupDetailsOpen(true);
            }
        }, { type: 'divider' });

        showContextMenu(e, menuItems, { title: group.title, tint: group.color || null });
    };

    const handleBoardContextMenu = (e, board) => {
        if (state.selectedItems?.length > 1 && state.selectedItems.includes(board.id)) {
            return handleBulkContextMenu(e, 'board');
        }
        showContextMenu(e, getBoardContextItems(board), { title: board.title, tint: board.color || null });
    };

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
