import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { useContextMenu, useLongPress } from '../Common/ContextMenu';
import { usePomodoro } from '../../context/PomodoroContext';
import {
    Sun, Star, CalendarDays, LayoutGrid, Plus, LogOut,
    ChevronLeft, Sparkles, Settings, HelpCircle,
    Edit3, Trash2, Copy, Palette, Focus, LayoutDashboard
} from 'lucide-react';
import './Sidebar.css';

export default function Sidebar({ activeView, onViewChange, isOpen, onClose, isDesktop }) {
    const { user, logout } = useAuth();
    const { state, dispatch, getMyDayCards, getImportantCards, getPlannedCards, DEFAULT_BOARD_COLORS } = useApp();
    const { showContextMenu } = useContextMenu();
    const { setIsOpen: setPomodoroOpen } = usePomodoro();
    const [showNewBoard, setShowNewBoard] = useState(false);
    const [newBoardTitle, setNewBoardTitle] = useState('');

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
        logout();
    };

    // Board context menu
    const getBoardContextItems = (board) => [
        {
            label: 'Renomear',
            icon: <Edit3 size={15} />,
            action: () => {
                const newTitle = prompt('Novo nome do board:', board.title);
                if (newTitle?.trim()) {
                    dispatch({ type: 'UPDATE_BOARD', payload: { id: board.id, updates: { title: newTitle.trim() } } });
                }
            },
        },
        {
            label: 'Mudar cor',
            icon: <Palette size={15} />,
            action: () => {
                const nextColor = DEFAULT_BOARD_COLORS[
                    (DEFAULT_BOARD_COLORS.indexOf(board.color) + 1) % DEFAULT_BOARD_COLORS.length
                ];
                dispatch({ type: 'UPDATE_BOARD', payload: { id: board.id, updates: { color: nextColor } } });
            },
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

                        <div className="sidebar-board-list">
                            {state.boards.map(board => (
                                <button
                                    key={board.id}
                                    className={`sidebar-item ${activeView === 'board' && state.activeBoard === board.id ? 'sidebar-item-active' : ''
                                        }`}
                                    onClick={() => handleBoardClick(board.id)}
                                    onContextMenu={(e) => handleBoardContextMenu(e, board)}
                                >
                                    <span className="sidebar-board-dot" style={{ background: board.color }} />
                                    <span className="truncate">{board.emoji} {board.title}</span>
                                    <span className="sidebar-badge-subtle">
                                        {board.lists.reduce((acc, l) => acc + l.cards.length, 0)}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* OTHERS section */}
                    <nav className="sidebar-nav sidebar-others">
                        <div className="sidebar-section-label">OUTROS</div>
                        <button
                            className="sidebar-item"
                            onClick={() => setPomodoroOpen(true)}
                        >
                            <span className="sidebar-item-icon">
                                <Focus size={18} />
                            </span>
                            <span>Modo Foco</span>
                        </button>
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
        </>
    );
}
