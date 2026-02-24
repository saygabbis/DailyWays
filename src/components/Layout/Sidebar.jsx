import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { insertBoardFull, deleteBoard } from '../../services/boardService';

import { usePomodoro } from '../../context/PomodoroContext';
import { useRadio } from '../../context/RadioContext';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import BoardDetailsModal from '../Sidebar/BoardDetailsModal';
import SidebarGroup from './SidebarGroup';
import {
    Sun, Star, CalendarDays, LayoutGrid, Plus, LogOut,
    ChevronLeft, Settings, HelpCircle,
    Edit3, Trash2, Copy, Palette, Focus, LayoutDashboard,
    MoreHorizontal, Music, Box, FolderPlus, Check, Folder
} from 'lucide-react';
import { useContextMenu } from '../Common/ContextMenu';
import logoWhite from '../../assets/Logo - Branco.png';
import logoBlack from '../../assets/Logo - Preto.png';
import './Sidebar.css';
import { useI18n, useTheme } from '../../context/ThemeContext';

const BulkDragFollowers = ({ count }) => {
    if (count <= 1) return null;

    // Create 1 or 2 background cards for the "stack" effect to keep it clean
    const followers = Array.from({ length: Math.min(count - 1, 2) });

    return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: -1 }}>
            {followers.map((_, idx) => (
                <div
                    key={idx}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'var(--bg-hover)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: 'var(--shadow-md)',
                        opacity: 0.95 - (idx * 0.15),
                        transformOrigin: 'bottom left',
                        transform: `rotate(${-(idx + 1) * 3}deg) translateY(${(idx + 1) * 6}px)`
                    }}
                />
            ))}
            <div
                className="bulk-drag-badge"
                style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '-8px',
                    background: 'var(--danger)',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}
            >
                {count}
            </div>
        </div>
    );
};

export default function Sidebar({ activeView, onViewChange, isOpen, onClose, isDesktop }) {
    const { user, logout } = useAuth();
    const {
        state, dispatch, getMyDayCards, getImportantCards, getPlannedCards,
        DEFAULT_BOARD_COLORS, updateBoardAndPersist, updateBoardAndPersistImmediate,
        updateBoardsOrder, persistBoard, getActiveBoard, isSavingBoard, suppressRealtime,
        showConfirm,
    } = useApp();
    const t = useI18n();
    const { theme } = useTheme();
    const isLightTheme = ['light', 'latte', 'ocean', 'nord'].includes(theme);
    const logoImg = isLightTheme ? logoBlack : logoWhite;
    const { toggleOpen: togglePomodoro } = usePomodoro();
    const { toggleOpen: toggleRadio } = useRadio();
    const { showContextMenu } = useContextMenu();

    const [showNewBoard, setShowNewBoard] = useState(false);
    const [newBoardTitle, setNewBoardTitle] = useState('');
    const [showNewSpace, setShowNewSpace] = useState(false);
    const [newSpaceTitle, setNewSpaceTitle] = useState('');
    const [showNewFolder, setShowNewFolder] = useState(false);
    const [newFolderTitle, setNewFolderTitle] = useState('');
    const [folderContextType, setFolderContextType] = useState('board');
    const [editingBoardId, setEditingBoardId] = useState(null);
    const [editBoardTitle, setEditBoardTitle] = useState('');
    const [detailsBoard, setDetailsBoard] = useState(null);

    // Resizable sidebar
    const sidebarRef = useRef(null);
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const stored = localStorage.getItem('dailyways_sidebar_width');
        return stored ? parseInt(stored) : 260;
    });
    const isResizing = useRef(false);

    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        isResizing.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const handleMouseMove = (e) => {
            if (!isResizing.current) return;
            const newWidth = Math.min(400, Math.max(200, e.clientX));
            setSidebarWidth(newWidth);
        };

        const handleMouseUp = () => {
            isResizing.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, []);

    useEffect(() => {
        localStorage.setItem('dailyways_sidebar_width', sidebarWidth);
        document.documentElement.style.setProperty('--sidebar-width', `${sidebarWidth}px`);
    }, [sidebarWidth]);

    const generalItems = [
        { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard },
        { id: 'myday', label: t.myday, icon: Sun, count: getMyDayCards().length, droppableId: 'sidebar-myday' },
        { id: 'important', label: t.important, icon: Star, count: getImportantCards().length, droppableId: 'sidebar-important' },
        { id: 'planned', label: t.planned, icon: CalendarDays, count: getPlannedCards().length, droppableId: 'sidebar-planned' },
    ];

    const othersItems = [
        { id: 'settings', label: t.settings, icon: Settings },
        { id: 'help', label: t.help, icon: HelpCircle },
    ];

    const activeBoards = state.boards || [];
    const activeSpaces = state.spaces || [];
    const allItems = [...activeBoards, ...activeSpaces];
    const activeGroups = state.groups || [];

    // Board groupings
    const boardGroups = activeGroups.filter(g => g.type === 'board').sort((a, b) => a.position - b.position);
    const rootBoards = activeBoards.filter(b => !b.groupId).sort((a, b) => a.position - b.position);

    // Space groupings
    const spaceGroups = activeGroups.filter(g => g.type === 'space').sort((a, b) => a.position - b.position);
    const rootSpaces = activeSpaces.filter(s => !s.groupId).sort((a, b) => a.position - b.position);

    const handleAddBoard = async (e) => {
        e.preventDefault();
        if (!newBoardTitle.trim()) return;

        // Criar o board com IDs definitivos (mesmo id que vai ao Supabase)
        const newBoard = {
            id: crypto.randomUUID(),
            title: newBoardTitle.trim(),
            color: DEFAULT_BOARD_COLORS[Math.floor(Math.random() * DEFAULT_BOARD_COLORS.length)],
            emoji: '📋',
            createdAt: new Date().toISOString(),
            lists: [
                { id: crypto.randomUUID(), title: 'A Fazer', color: null, isCompletionList: false, cards: [] },
                { id: crypto.randomUUID(), title: 'Em Progresso', color: null, isCompletionList: false, cards: [] },
                { id: crypto.randomUUID(), title: 'Concluído', color: null, isCompletionList: true, cards: [] },
            ],
        };

        // Estado local imediato (otimismo) — ADD_BOARD usará o mesmo id e listas
        dispatch({ type: 'ADD_BOARD', payload: newBoard });
        // SET_ACTIVE_BOARD persiste o id no localStorage (ADD_BOARD não faz isso)
        dispatch({ type: 'SET_ACTIVE_BOARD', payload: newBoard.id });
        setNewBoardTitle('');
        setShowNewBoard(false);
        onViewChange('board');

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
            id: crypto.randomUUID(),
            title: newFolderTitle.trim(),
            type: folderContextType,
            position: state.groups.filter(g => g.type === folderContextType).length,
            isExpanded: false
        };

        dispatch({ type: 'ADD_GROUP', payload: newGroup });

        // If there are selected items of the same type, move them into this new folder
        if (state.selectedItems?.length > 0 && state.selectionType === folderContextType) {
            state.selectedItems.forEach(itemId => {
                dispatch({
                    type: 'MOVE_WORKSPACE_ITEM',
                    payload: { itemType: folderContextType + 's', itemIds: [itemId], destGroupId: newGroup.id, destIndex: 0 }
                });
            });
            dispatch({ type: 'CLEAR_SELECTION' });
        }

        setNewFolderTitle('');
        setShowNewFolder(false);

        const { insertGroup, updateEntitiesOrder } = await import('../../services/workspaceService');
        await insertGroup(user.id, newGroup);

        // If we moved items, we need to sync their order to backend
        if (state.selectedItems?.length > 0 && state.selectionType === folderContextType) {
            if (suppressRealtime) suppressRealtime(2000);
            const list = state[folderContextType + 's'];
            const updatedItems = [];
            // We just let the UI calculate position or we send the destGroupId updates
            state.selectedItems.forEach(itemId => {
                updatedItems.push({ id: itemId, groupId: newGroup.id, position: 0 }); // In a real app we'd recalculate proper indices
            });
            try {
                await updateEntitiesOrder(folderContextType + 's', updatedItems);
            } catch (e) { }
        }
    };

    const handleAddSpace = async (e) => {
        if (e) e.preventDefault();
        if (!newSpaceTitle.trim()) return;

        const newSpace = {
            id: crypto.randomUUID(),
            title: newSpaceTitle.trim(),
            color: DEFAULT_BOARD_COLORS[Math.floor(Math.random() * DEFAULT_BOARD_COLORS.length)],
            emoji: '🌌',
            position: state.spaces.length,
            groupId: null,
            panX: 0,
            panY: 0,
            zoom: 1,
            createdAt: new Date().toISOString(),
        };

        dispatch({ type: 'ADD_SPACE', payload: newSpace });
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
        onViewChange('board');
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



    const handleStartRename = (board) => {
        setEditingBoardId(board.id);
        setEditBoardTitle(board.title);
    };

    const handleRenameSubmit = async (e, boardId) => {
        if (e) e.preventDefault();
        const titleToSave = editBoardTitle.trim();
        setEditingBoardId(null); // Close UI immediately

        if (titleToSave) {
            await updateBoardAndPersist(boardId, { title: titleToSave });
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
                    id: crypto.randomUUID(),
                    title: `${board.title} (cópia)`,
                    createdAt: new Date().toISOString(),
                    lists: board.lists.map(l => ({
                        ...l,
                        id: crypto.randomUUID(),
                        cards: l.cards.map(c => ({
                            ...c,
                            id: crypto.randomUUID(),
                            subtasks: (c.subtasks || []).map(st => ({ ...st, id: crypto.randomUUID() })),
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
            label: 'Deletar board',
            icon: <Trash2 size={15} />,
            danger: true,
            action: async () => {
                const confirmed = await showConfirm({
                    title: 'Deletar Board',
                    message: `Tem certeza que deseja deletar o board "${board.title}"? Esta ação não pode ser desfeita.`,
                    confirmLabel: 'Deletar',
                    type: 'danger'
                });
                if (confirmed) {
                    const isActive = state.activeBoard === board.id;
                    const boardIndex = state.boards.findIndex(b => b.id === board.id);
                    dispatch({ type: 'DELETE_BOARD', payload: board.id });
                    if (suppressRealtime) suppressRealtime(3000);

                    // Ativa o floating save durante a operação no servidor
                    dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId: '__board_ops__', saving: true } });
                    try {
                        await deleteBoard(board.id);
                    } finally {
                        dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId: '__board_ops__', saving: false } });
                    }

                    if (isActive) {
                        const remaining = state.boards.filter(b => b.id !== board.id);
                        if (remaining.length > 0) {
                            // vai para o próximo, ou para o anterior se era o último
                            const next = remaining[boardIndex] ?? remaining[boardIndex - 1];
                            dispatch({ type: 'SET_ACTIVE_BOARD', payload: next.id });
                            onViewChange('board');
                        } else {
                            onViewChange('dashboard');
                        }
                    }
                }
            },
        },
    ];

    const handleGroupCheckboxClick = (e, group, groupItems) => {
        e.stopPropagation();
        if (group.isExpanded && groupItems.length > 0) {
            const ids = groupItems.map(i => i.id);
            const itemType = group.type;
            const allSelected = ids.every(id => state.selectedItems?.includes(id));
            if (allSelected) {
                dispatch({ type: 'CLEAR_SELECTION' });
            } else {
                dispatch({ type: 'SET_SELECTION', payload: { type: itemType, items: ids } });
            }
        } else {
            dispatch({ type: 'TOGGLE_SELECTION', payload: { id: group.id, type: 'group' } });
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
                                for (const id of itemsToDelete) await deleteBoard(id);
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
            }
        ];

        if (itemType === 'group') {
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

        showContextMenu(e, items, { title: `${count} Selecionados` });
    };

    const handleSpaceContextMenu = (e, space) => {
        if (state.selectedItems?.length > 1 && state.selectedItems.includes(space.id)) {
            return handleBulkContextMenu(e, 'space');
        }
        showContextMenu(e, [
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
                        dispatch({ type: 'DELETE_SPACE', payload: space.id });
                        if (suppressRealtime) suppressRealtime(3000);
                        const { deleteSpace } = await import('../../services/workspaceService');
                        await deleteSpace(space.id);
                    }
                },
            },
        ], { title: space.title });
    };

    const handleGroupContextMenu = (e, group) => {
        if (state.selectedItems?.length > 1 && state.selectedItems.includes(group.id)) {
            return handleBulkContextMenu(e, 'group');
        }
        showContextMenu(e, [
            {
                label: 'Renomear Grupo',
                icon: <Edit3 size={15} />,
                action: () => alert('Opcão em desenvolvimento.'),
            },
            { type: 'divider' },
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
                            const { deleteGroup, fetchGroups } = await import('../../services/workspaceService');
                            // Move items out
                            const items = group.type === 'board' ? state.boards : state.spaces;
                            const groupItems = items.filter(i => i.groupId === group.id);
                            groupItems.forEach(i => {
                                dispatch({ type: 'MOVE_WORKSPACE_ITEM', payload: { itemType: group.type + 's', itemIds: [i.id], sourceGroupId: group.id, destGroupId: null, destIndex: 0 } });
                            });

                            dispatch({ type: 'DELETE_GROUP', payload: group.id });
                            if (suppressRealtime) suppressRealtime(3000);
                            await deleteGroup(group.id);
                        } catch (err) {
                            console.error('Failed to delete group', err);
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
                        try {
                            const { deleteGroup, fetchGroups } = await import('../../services/workspaceService');
                            dispatch({ type: 'DELETE_GROUP', payload: group.id });

                            // Delete items locally
                            const items = group.type === 'board' ? state.boards : state.spaces;
                            const groupItems = items.filter(i => i.groupId === group.id);

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

                            // Trigger backend deletes
                            if (boardIdsToDelete.length > 0) {
                                const { deleteBoard } = await import('../../services/boardService');
                                for (const id of boardIdsToDelete) await deleteBoard(id);
                            }
                            if (spaceIdsToDelete.length > 0) {
                                const { deleteSpace } = await import('../../services/workspaceService');
                                for (const id of spaceIdsToDelete) await deleteSpace(id);
                            }

                        } catch (err) {
                            console.error('Failed to delete group', err);
                        }
                    }
                },
            },
        ], { title: group.title });
    };

    const handleBoardContextMenu = (e, board) => {
        if (state.selectedItems?.length > 1 && state.selectedItems.includes(board.id)) {
            return handleBulkContextMenu(e, 'board');
        }
        showContextMenu(e, getBoardContextItems(board), { title: board.title });
    };

    return (
        <>
            {isOpen && !isDesktop && <div className="sidebar-overlay" onClick={onClose} />}
            <aside
                ref={sidebarRef}
                className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}
                style={isDesktop ? { width: sidebarWidth } : undefined}
            >
                {/* Header */}
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <img src={logoImg} alt="DailyWays" className="sidebar-logo-img" />
                        <span className="sidebar-logo-name">DailyWays</span>
                    </div>
                    <button className="btn-icon sidebar-close" onClick={onClose}>
                        <ChevronLeft size={20} />
                    </button>
                </div>

                <div className="sidebar-body">
                    {/* GENERAL section */}
                    <nav className="sidebar-nav">
                        <div className="sidebar-section-label">{t.general}</div>
                        {generalItems.map(item => (
                            item.droppableId ? (
                                <Droppable key={item.id} droppableId={item.droppableId} type="card" isDropDisabled={false}>
                                    {(provided, snapshot) => (
                                        <div ref={provided.innerRef} {...provided.droppableProps}>
                                            <button
                                                className={`sidebar-item ${activeView === item.id ? 'sidebar-item-active' : ''} ${snapshot.isDraggingOver ? 'sidebar-item-drop-active' : ''}`}
                                                onClick={() => handleNavClick(item.id)}
                                            >
                                                <span className="sidebar-item-icon">
                                                    <item.icon size={18} />
                                                </span>
                                                <span>{item.label}</span>
                                                {snapshot.isDraggingOver && <span className="sidebar-drop-hint">Soltar aqui</span>}
                                                {!snapshot.isDraggingOver && item.count > 0 && <span className="sidebar-badge">{item.count}</span>}
                                            </button>
                                            <div style={{ display: 'none' }}>{provided.placeholder}</div>
                                        </div>
                                    )}
                                </Droppable>
                            ) : (
                                <button
                                    key={item.id}
                                    className={`sidebar-item ${activeView === item.id ? 'sidebar-item-active' : ''}`}
                                    onClick={() => handleNavClick(item.id)}
                                >
                                    <span className="sidebar-item-icon">
                                        <item.icon size={18} />
                                    </span>
                                    <span>{item.label}</span>
                                    {item.count > 0 && <span className="sidebar-badge">{item.count}</span>}
                                </button>
                            )
                        ))}
                    </nav>

                    {/* Boards section */}
                    <div className="sidebar-boards-section">
                        <div className="sidebar-section-header">
                            <span className="sidebar-section-label">
                                <LayoutGrid size={13} /> {t.boards}
                            </span>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button className="btn-icon btn-sm" onClick={() => { setFolderContextType('board'); setShowNewFolder(true); }} title="Nova Pasta">
                                    <FolderPlus size={16} />
                                </button>
                                <button className="btn-icon btn-sm" onClick={() => setShowNewBoard(true)} title={t.newBoard}>
                                    <Plus size={16} />
                                </button>
                            </div>
                        </div>

                        {showNewFolder && folderContextType === 'board' && (
                            <form onSubmit={handleAddFolder} className="sidebar-new-board animate-slide-up">
                                <input
                                    type="text"
                                    placeholder="Nome da pasta..."
                                    value={newFolderTitle}
                                    onChange={e => setNewFolderTitle(e.target.value)}
                                    autoFocus
                                    onBlur={() => { if (!newFolderTitle.trim()) setShowNewFolder(false); }}
                                />
                            </form>
                        )}

                        {showNewBoard && (
                            <form onSubmit={handleAddBoard} className="sidebar-new-board animate-slide-up">
                                <input
                                    type="text"
                                    placeholder="Nome do board..."
                                    value={newBoardTitle}
                                    onChange={e => setNewBoardTitle(e.target.value)}
                                    autoFocus
                                    onBlur={() => { if (!newBoardTitle.trim()) setShowNewBoard(false); }}
                                />
                            </form>
                        )}

                        <Droppable droppableId="groups-board" type="board">
                            {(provided) => (
                                <div className="sidebar-board-list" {...provided.droppableProps} ref={provided.innerRef}>
                                    {boardGroups.map((group, index) => (
                                        <SidebarGroup
                                            key={group.id}
                                            group={group}
                                            index={index}
                                            items={activeBoards.filter(b => b.groupId === group.id).sort((a, b) => a.position - b.position)}
                                            activeView={activeView}
                                            activeBoard={state.activeBoard}
                                            onContextMenu={handleGroupContextMenu}
                                            onToggleSelection={(e) => handleGroupCheckboxClick(e, group, activeBoards.filter(b => b.groupId === group.id))}
                                            selectedItems={state.selectedItems}
                                            onClickItem={async (g) => {
                                                const newExpanded = !g.isExpanded;
                                                dispatch({ type: 'UPDATE_GROUP', payload: { id: g.id, updates: { isExpanded: newExpanded } } });
                                                if (suppressRealtime) suppressRealtime(2000);
                                                try {
                                                    const { updateGroup } = await import('../../services/workspaceService');
                                                    await updateGroup(g.id, { isExpanded: newExpanded });
                                                } catch (err) {
                                                    console.error('Failed to update group expanded state', err);
                                                }
                                            }}
                                            renderItem={(board, bIndex) => (
                                                <Draggable key={board.id} draggableId={board.id} index={bIndex}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            className={`sidebar-item board-item ${state.selectedItems?.includes(board.id) ? 'selected' : ''} ${activeView === 'board' && state.activeBoard === board.id ? 'sidebar-item-active' : ''} ${snapshot.isDragging ? 'dragging' : ''} ${state.isDraggingBulk && snapshot.isDragging ? 'dragging-bulk-stack' : ''} ${state.isDraggingBulk && state.selectedItems?.includes(board.id) && !snapshot.isDragging ? 'bulk-hidden' : ''}`}
                                                            onClick={(e) => handleBoardClick(e, board.id)}
                                                            onContextMenu={(e) => handleBoardContextMenu(e, board)}
                                                            onDoubleClick={() => isDesktop && handleStartRename(board)}
                                                        >
                                                            <div
                                                                className={`sidebar-board-checkbox ${state.selectedItems?.includes(board.id) ? 'selected' : ''}`}
                                                                title="Selecionar"
                                                                onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_SELECTION', payload: { id: board.id, type: 'board' } }); }}
                                                            >
                                                                {state.selectedItems?.includes(board.id) && <Check size={10} strokeWidth={4} />}
                                                            </div>
                                                            <span className="sidebar-board-dot" style={{ background: board.color }} />
                                                            {editingBoardId === board.id ? (
                                                                <form onSubmit={(e) => handleRenameSubmit(e, board.id)} className="sidebar-rename-form">
                                                                    <input autoFocus value={editBoardTitle} onChange={e => setEditBoardTitle(e.target.value)} onBlur={(e) => handleRenameSubmit(e, board.id)} onKeyDown={e => e.key === 'Escape' && setEditingBoardId(null)} />
                                                                </form>
                                                            ) : (
                                                                <span className="truncate">{board.emoji} {board.title}</span>
                                                            )}
                                                            <span className="sidebar-badge-subtle">{board.lists.reduce((acc, l) => acc + l.cards.length, 0)}</span>
                                                            {state.isDraggingBulk && snapshot.isDragging && (
                                                                <BulkDragFollowers count={state.selectedItems.length} />
                                                            )}
                                                        </div>
                                                    )}
                                                </Draggable>
                                            )}
                                        />
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>

                        <Droppable droppableId="boards-root" type="board">
                            {(provided) => (
                                <div className="sidebar-board-list" {...provided.droppableProps} ref={provided.innerRef}>
                                    {rootBoards.map((board, index) => (
                                        <Draggable key={board.id} draggableId={board.id} index={index}>
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    {...provided.dragHandleProps}
                                                    className={`sidebar-item board-item ${activeView === 'board' && state.activeBoard === board.id ? 'sidebar-item-active' : ''} ${state.selectedItems?.includes(board.id) ? 'selected' : ''} ${snapshot.isDragging ? 'dragging' : ''} ${state.isDraggingBulk && snapshot.isDragging ? 'dragging-bulk-stack' : ''} ${state.isDraggingBulk && state.selectedItems?.includes(board.id) && !snapshot.isDragging ? 'bulk-hidden' : ''}`}
                                                    onClick={(e) => handleBoardClick(e, board.id)}
                                                    onContextMenu={(e) => handleBoardContextMenu(e, board)}
                                                    onDoubleClick={() => isDesktop && handleStartRename(board)}
                                                >
                                                    <div
                                                        className={`sidebar-board-checkbox ${state.selectedItems?.includes(board.id) ? 'selected' : ''}`}
                                                        title="Selecionar"
                                                        onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_SELECTION', payload: { id: board.id, type: 'board' } }); }}
                                                    >
                                                        {state.selectedItems?.includes(board.id) && <Check size={10} strokeWidth={4} />}
                                                    </div>
                                                    <span className="sidebar-board-dot" style={{ background: board.color }} />
                                                    {editingBoardId === board.id ? (
                                                        <form onSubmit={(e) => handleRenameSubmit(e, board.id)} className="sidebar-rename-form">
                                                            <input autoFocus value={editBoardTitle} onChange={e => setEditBoardTitle(e.target.value)} onBlur={(e) => handleRenameSubmit(e, board.id)} onKeyDown={e => e.key === 'Escape' && setEditingBoardId(null)} />
                                                        </form>
                                                    ) : (
                                                        <span className="truncate">{board.emoji} {board.title}</span>
                                                    )}
                                                    <span className="sidebar-badge-subtle">{board.lists.reduce((acc, l) => acc + l.cards.length, 0)}</span>
                                                    {state.isDraggingBulk && snapshot.isDragging && (
                                                        <BulkDragFollowers count={state.selectedItems.length} />
                                                    )}
                                                </div>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </div>

                    {/* Spaces section */}
                    <div className="sidebar-boards-section" style={{ marginTop: '16px' }}>
                        <div className="sidebar-section-header">
                            <span className="sidebar-section-label">
                                <Box size={13} /> Spaces
                            </span>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button className="btn-icon btn-sm" onClick={() => { setFolderContextType('space'); setShowNewFolder(true); }} title="Nova Pasta">
                                    <FolderPlus size={16} />
                                </button>
                                <button className="btn-icon btn-sm" onClick={() => setShowNewSpace(true)} title="Novo Space">
                                    <Plus size={16} />
                                </button>
                            </div>
                        </div>

                        {showNewFolder && folderContextType === 'space' && (
                            <form onSubmit={handleAddFolder} className="sidebar-new-board animate-slide-up">
                                <input
                                    type="text"
                                    placeholder="Nome da pasta..."
                                    value={newFolderTitle}
                                    onChange={e => setNewFolderTitle(e.target.value)}
                                    autoFocus
                                    onBlur={() => { if (!newFolderTitle.trim()) setShowNewFolder(false); }}
                                />
                            </form>
                        )}

                        {showNewSpace && (
                            <form onSubmit={handleAddSpace} className="sidebar-new-board animate-slide-up">
                                <input
                                    type="text"
                                    placeholder="Nome do space..."
                                    value={newSpaceTitle}
                                    onChange={e => setNewSpaceTitle(e.target.value)}
                                    autoFocus
                                    onBlur={() => { if (!newSpaceTitle.trim()) setShowNewSpace(false); }}
                                />
                            </form>
                        )}

                        <Droppable droppableId="groups-space" type="space">
                            {(provided) => (
                                <div className="sidebar-board-list" {...provided.droppableProps} ref={provided.innerRef}>
                                    {spaceGroups.map((group, index) => (
                                        <SidebarGroup
                                            key={group.id}
                                            group={group}
                                            index={index}
                                            items={activeSpaces.filter(s => s.groupId === group.id).sort((a, b) => a.position - b.position)}
                                            activeView={activeView}
                                            activeBoard={state.activeBoard}
                                            onContextMenu={(e, g) => handleGroupContextMenu(e, g)}
                                            onToggleSelection={(e) => handleGroupCheckboxClick(e, group, activeSpaces.filter(s => s.groupId === group.id))}
                                            selectedItems={state.selectedItems}
                                            onClickItem={async (g) => {
                                                const newExpanded = !g.isExpanded;
                                                dispatch({ type: 'UPDATE_GROUP', payload: { id: g.id, updates: { isExpanded: newExpanded } } });
                                                if (suppressRealtime) suppressRealtime(2000);
                                                try {
                                                    const { updateGroup } = await import('../../services/workspaceService');
                                                    await updateGroup(g.id, { isExpanded: newExpanded });
                                                } catch (err) {
                                                    console.error('Failed to update group expanded state', err);
                                                }
                                            }}
                                            renderItem={(space, sIndex) => (
                                                <Draggable key={space.id} draggableId={space.id} index={sIndex}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            className={`sidebar-item board-item ${state.selectedItems?.includes(space.id) ? 'selected' : ''} ${activeView === `space-${space.id}` ? 'sidebar-item-active' : ''} ${snapshot.isDragging ? 'dragging' : ''} ${state.isDraggingBulk && snapshot.isDragging ? 'dragging-bulk-stack' : ''} ${state.isDraggingBulk && state.selectedItems?.includes(space.id) && !snapshot.isDragging ? 'bulk-hidden' : ''}`}
                                                            onClick={(e) => handleSpaceClick(e, space.id)}
                                                            onContextMenu={(e) => handleSpaceContextMenu(e, space)}
                                                        >
                                                            <div
                                                                className={`sidebar-board-checkbox ${state.selectedItems?.includes(space.id) ? 'selected' : ''}`}
                                                                title="Selecionar"
                                                                onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_SELECTION', payload: { id: space.id, type: 'space' } }); }}
                                                            >
                                                                {state.selectedItems?.includes(space.id) && <Check size={10} strokeWidth={4} />}
                                                            </div>
                                                            <span className="sidebar-board-dot" style={{ background: space.color || '#9b59b6' }} />
                                                            <span className="truncate">{space.emoji} {space.title}</span>
                                                            {state.isDraggingBulk && snapshot.isDragging && (
                                                                <BulkDragFollowers count={state.selectedItems.length} />
                                                            )}
                                                        </div>
                                                    )}
                                                </Draggable>
                                            )}
                                        />
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>

                        <Droppable droppableId="spaces-root" type="space">
                            {(provided) => (
                                <div className="sidebar-board-list" {...provided.droppableProps} ref={provided.innerRef}>
                                    {rootSpaces.map((space, index) => (
                                        <Draggable key={space.id} draggableId={space.id} index={index}>
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    {...provided.dragHandleProps}
                                                    className={`sidebar-item board-item ${activeView === `space-${space.id}` ? 'sidebar-item-active' : ''} ${state.selectedItems?.includes(space.id) ? 'selected' : ''} ${snapshot.isDragging ? 'dragging' : ''} ${state.isDraggingBulk && snapshot.isDragging ? 'dragging-bulk-stack' : ''} ${state.isDraggingBulk && state.selectedItems?.includes(space.id) && !snapshot.isDragging ? 'bulk-hidden' : ''}`}
                                                    onClick={(e) => handleSpaceClick(e, space.id)}
                                                    onContextMenu={(e) => handleSpaceContextMenu(e, space)}
                                                >
                                                    <div
                                                        className={`sidebar-board-checkbox ${state.selectedItems?.includes(space.id) ? 'selected' : ''}`}
                                                        title="Selecionar"
                                                        onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_SELECTION', payload: { id: space.id, type: 'space' } }); }}
                                                    >
                                                        {state.selectedItems?.includes(space.id) && <Check size={10} strokeWidth={4} />}
                                                    </div>
                                                    <span className="sidebar-board-dot" style={{ background: space.color || '#9b59b6' }} />
                                                    <span className="truncate">{space.emoji} {space.title}</span>
                                                    {state.isDraggingBulk && snapshot.isDragging && (
                                                        <BulkDragFollowers count={state.selectedItems.length} />
                                                    )}
                                                </div>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </div>

                    {/* RECURSOS section */}
                    <nav className="sidebar-nav">
                        <div className="sidebar-section-label">{t.resources}</div>
                        <button
                            className="sidebar-item"
                            onClick={togglePomodoro}
                        >
                            <span className="sidebar-item-icon">
                                <Focus size={18} />
                            </span>
                            <span>{t.focusMode}</span>
                        </button>
                        <button
                            className="sidebar-item"
                            onClick={toggleRadio}
                        >
                            <span className="sidebar-item-icon">
                                <Music size={18} />
                            </span>
                            <span>{t.radio}</span>
                        </button>
                    </nav>

                    {/* OTHERS section */}
                    <nav className="sidebar-nav sidebar-others">
                        <div className="sidebar-section-label">{t.others}</div>
                        {othersItems.map(item => (
                            <button
                                key={item.id}
                                className={`sidebar-item ${activeView === item.id ? 'sidebar-item-active' : ''}`}
                                onClick={() => handleNavClick(item.id)}
                            >
                                <span className="sidebar-item-icon">
                                    <item.icon size={18} />
                                </span>
                                <span>{item.label}</span>
                            </button>
                        ))}

                        {/* Logout */}
                        <button className="sidebar-item sidebar-logout" onClick={handleLogout}>
                            <span className="sidebar-item-icon">
                                <LogOut size={18} />
                            </span>
                            <span>{t.logout}</span>
                        </button>
                    </nav>
                </div>
                {/* Resize handle */}
                {isDesktop && (
                    <div className="sidebar-resize-handle" onMouseDown={handleMouseDown} />
                )}
            </aside>

            {/* Board details modal */}
            {detailsBoard && (
                <BoardDetailsModal
                    board={detailsBoard}
                    onClose={() => setDetailsBoard(null)}
                />
            )}
        </>
    );
}
