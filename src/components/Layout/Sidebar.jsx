import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { insertBoardFull, deleteBoard } from '../../services/boardService';

import { usePomodoro } from '../../context/PomodoroContext';
import { useRadio } from '../../context/RadioContext';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import BoardDetailsModal from '../Sidebar/BoardDetailsModal';
import {
    Sun, Star, CalendarDays, LayoutGrid, Plus, LogOut,
    ChevronLeft, Settings, HelpCircle,
    Edit3, Trash2, Copy, Palette, Focus, LayoutDashboard,
    MoreHorizontal, Music
} from 'lucide-react';
import { useContextMenu } from '../Common/ContextMenu';
import logoWhite from '../../assets/Logo - Branco.png';
import logoBlack from '../../assets/Logo - Preto.png';
import './Sidebar.css';
import { useI18n, useTheme } from '../../context/ThemeContext';

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

    const handleBoardClick = (boardId) => {
        dispatch({ type: 'SET_ACTIVE_BOARD', payload: boardId });
        onViewChange('board');
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

    const handleBoardContextMenu = (e, board) => {
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
                            <button className="btn-icon btn-sm" onClick={() => setShowNewBoard(true)} title={t.newBoard}>
                                <Plus size={16} />
                            </button>
                        </div>

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

                        <Droppable droppableId="boards" type="board">
                            {(provided) => (
                                <div
                                    className="sidebar-board-list"
                                    {...provided.droppableProps}
                                    ref={provided.innerRef}
                                >
                                    {state.boards.map((board, index) => (
                                        <Draggable key={board.id} draggableId={board.id} index={index}>
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    {...provided.dragHandleProps}
                                                    className={`sidebar-item board-item ${activeView === 'board' && state.activeBoard === board.id ? 'sidebar-item-active' : ''} ${snapshot.isDragging ? 'dragging' : ''}`}
                                                    onClick={() => handleBoardClick(board.id)}
                                                    onContextMenu={(e) => handleBoardContextMenu(e, board)}
                                                    onDoubleClick={() => isDesktop && handleStartRename(board)}
                                                >
                                                    <div
                                                        className="board-drag-indicator"
                                                        title="Mais opções"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleBoardContextMenu(e, board);
                                                        }}
                                                    >
                                                        <MoreHorizontal size={14} className="rotate-90" />
                                                    </div>

                                                    <span className="sidebar-board-dot" style={{ background: board.color }} />

                                                    {editingBoardId === board.id ? (
                                                        <form onSubmit={(e) => handleRenameSubmit(e, board.id)} className="sidebar-rename-form">
                                                            <input
                                                                autoFocus
                                                                value={editBoardTitle}
                                                                onChange={e => setEditBoardTitle(e.target.value)}
                                                                onBlur={(e) => handleRenameSubmit(e, board.id)}
                                                                onKeyDown={e => e.key === 'Escape' && setEditingBoardId(null)}
                                                            />
                                                        </form>
                                                    ) : (
                                                        <span className="truncate">{board.emoji} {board.title}</span>
                                                    )}

                                                    <span className="sidebar-badge-subtle">
                                                        {board.lists.reduce((acc, l) => acc + l.cards.length, 0)}
                                                    </span>
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
