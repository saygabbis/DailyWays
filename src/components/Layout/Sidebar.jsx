import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { useContextMenu, useLongPress } from '../Common/ContextMenu';
import { usePomodoro } from '../../context/PomodoroContext';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import BoardDetailsModal from '../Sidebar/BoardDetailsModal';
import {
    Sun, Star, CalendarDays, LayoutGrid, Plus, LogOut,
    ChevronLeft, Sparkles, Settings, HelpCircle,
    Edit3, Trash2, Copy, Palette, Focus, LayoutDashboard,
    MoreHorizontal
} from 'lucide-react';
import './Sidebar.css';

export default function Sidebar({ activeView, onViewChange, isOpen, onClose, isDesktop }) {
    const { user, confirmLogout } = useAuth();
    const {
        state, dispatch, getMyDayCards, getImportantCards, getPlannedCards,
        DEFAULT_BOARD_COLORS, updateBoardAndPersist, updateBoardAndPersistImmediate,
        updateBoardsOrder, persistBoard, getActiveBoard
    } = useApp();
    const { showContextMenu } = useContextMenu();
    const { toggleOpen } = usePomodoro();

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
        { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
        { id: 'myday', label: 'Meu Dia', icon: Sun, count: getMyDayCards().length },
        { id: 'important', label: 'Importante', icon: Star, count: getImportantCards().length },
        { id: 'planned', label: 'Planejado', icon: CalendarDays, count: getPlannedCards().length },
    ];

    const othersItems = [
        { id: 'settings', label: 'Configurações', icon: Settings },
        { id: 'help', label: 'Central de Ajuda', icon: HelpCircle },
    ];

    const handleAddBoard = (e) => {
        e.preventDefault();
        if (!newBoardTitle.trim()) return;
        dispatch({ type: 'ADD_BOARD', payload: { title: newBoardTitle } });
        setNewBoardTitle('');
        setShowNewBoard(false);
        onViewChange('board');
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

    const handleLogout = () => {
        onClose?.();
        confirmLogout();
    };

    const handleDragEnd = async (result) => {
        const { source, destination } = result;
        if (!destination || source.index === destination.index) return;

        dispatch({
            type: 'REORDER_BOARDS',
            payload: { sourceIndex: source.index, destIndex: destination.index },
            userId: user.id
        });

        // Persistir nova ordem imediatamente
        const newBoards = [...state.boards];
        const [moved] = newBoards.splice(source.index, 1);
        newBoards.splice(destination.index, 0, moved);
        const payloads = newBoards.map((b, i) => ({ id: b.id, position: i }));
        await updateBoardsOrder(user.id, payloads);
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
            action: () => dispatch({ type: 'DUPLICATE_BOARD', payload: board.id }),
        },
        { type: 'divider' },
        {
            label: 'Deletar board',
            icon: <Trash2 size={15} />,
            danger: true,
            action: () => {
                if (confirm(`Deletar "${board.title}"?`)) {
                    dispatch({ type: 'DELETE_BOARD', payload: board.id });
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
                        <Sparkles size={24} />
                        <span>DailyWays</span>
                    </div>
                    <button className="btn-icon sidebar-close" onClick={onClose}>
                        <ChevronLeft size={20} />
                    </button>
                </div>

                <div className="sidebar-body">
                    {/* GENERAL section */}
                    <nav className="sidebar-nav">
                        <div className="sidebar-section-label">GERAL</div>
                        {generalItems.map(item => (
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
                        ))}
                    </nav>

                    {/* Boards section */}
                    <div className="sidebar-boards-section">
                        <div className="sidebar-section-header">
                            <span className="sidebar-section-label">
                                <LayoutGrid size={13} /> BOARDS
                            </span>
                            <button className="btn-icon btn-sm" onClick={() => setShowNewBoard(true)} title="Novo Board">
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

                        <DragDropContext onDragEnd={handleDragEnd}>
                            <Droppable droppableId="boards">
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
                                                        <div className="board-drag-indicator">
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
                        </DragDropContext>
                    </div>

                    {/* RECURSOS section */}
                    <nav className="sidebar-nav">
                        <div className="sidebar-section-label">RECURSOS</div>
                        <button
                            className="sidebar-item"
                            onClick={toggleOpen}
                        >
                            <span className="sidebar-item-icon">
                                <Focus size={18} />
                            </span>
                            <span>Modo Foco</span>
                        </button>
                    </nav>

                    {/* OTHERS section */}
                    <nav className="sidebar-nav sidebar-others">
                        <div className="sidebar-section-label">OUTROS</div>
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
                            <span>Sair</span>
                        </button>
                    </nav>
                </div>
                {/* Resize handle */}
                {isDesktop && (
                    <div className="sidebar-resize-handle" onMouseDown={handleMouseDown} />
                )}
            </aside>

            {/* Modals */}
            {detailsBoard && (
                <BoardDetailsModal
                    board={detailsBoard}
                    onClose={() => setDetailsBoard(null)}
                />
            )}
        </>
    );
}
