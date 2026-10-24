import { useState } from 'react';
import { useAuth } from '../../context/useAuth';
import { useApp } from '../../context/useApp';
import { useBoardCollabContext } from '../../collab/board/ops/useBoardCollab';

import { usePomodoro } from '../../context/usePomodoro';
import { useRadio } from '../../context/useRadio';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import BoardDetailsModal from '../Board/BoardDetailsModal';
import SpaceDetailsModal from '../Spaces/SpaceDetailsModal';
import SidebarGroup from './SidebarGroup';
import GroupDetailsModal from './GroupDetailsModal';
import {
    Sun,
    Star,
    CalendarDays,
    LayoutGrid,
    Plus,
    LogOut,
    ChevronLeft,
    Settings,
    HelpCircle,
    Focus,
    LayoutDashboard,
    MoreHorizontal,
    Music,
    Box,
    FolderPlus,
    Check,
    Users,
} from 'lucide-react';
import { useContextMenu } from '../Common/useContextMenu';
import logoWhite from '../../assets/Logo - Branco.png';
import logoBlack from '../../assets/Logo - Preto.png';
import './Sidebar.css';
import { useI18n, useTheme } from '../../context/useTheme';
import BulkDragFollowers from './BulkDragFollowers';
import { useResizableSidebar } from './useResizableSidebar';
import { useSidebarActions } from './useSidebarActions';

export default function Sidebar({ activeView, onViewChange, isOpen, onClose, isDesktop }) {
    const { user, logout } = useAuth();
    const boardCollab = useBoardCollabContext();
    const {
        state, dispatch, getMyDayCards, getImportantCards, getPlannedCards,
        DEFAULT_BOARD_COLORS,
        suppressRealtime,
        showConfirm, reloadBoards, lastReorderedIds = [], setLastReorderedIds,
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
    const [editingGroupId, setEditingGroupId] = useState(null);
    const [editGroupTitle, setEditGroupTitle] = useState('');
    const [recentlyAddedId, setRecentlyAddedId] = useState(null);
    const [groupDetailsOpen, setGroupDetailsOpen] = useState(false);
    const [groupDetailsTarget, setGroupDetailsTarget] = useState(null);
    const [detailsBoard, setDetailsBoard] = useState(null);
    const [detailsSpace, setDetailsSpace] = useState(null);

    const { sidebarRef, sidebarWidth, handleMouseDown } = useResizableSidebar();

    const generalItems = [
        { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard },
        { id: 'myday', label: t.myday, icon: Sun, count: getMyDayCards().length, droppableId: 'sidebar-myday' },
        { id: 'important', label: t.important, icon: Star, count: getImportantCards().length, droppableId: 'sidebar-important' },
        { id: 'planned', label: t.planned, icon: CalendarDays, count: getPlannedCards().length, droppableId: 'sidebar-planned' },
    ];

    const othersItems = [
        { id: 'contacts', label: 'Contatos', icon: Users },
        { id: 'settings', label: t.settings, icon: Settings },
        { id: 'help', label: t.help, icon: HelpCircle },
    ];

    const activeBoards = state.boards || [];
    const activeSpaces = state.spaces || [];
    const allItems = [...activeBoards, ...activeSpaces];
    const activeGroups = state.groups || [];

    // Board groupings — boards com group_id da pasta de OUTRO utilizador (ex.: dono do board partilhado)
    // não têm essa pasta no nosso state.groups → tratamos como "raiz" para aparecerem na sidebar.
    const boardGroups = activeGroups.filter(g => g.type === 'board').sort((a, b) => a.position - b.position);
    const boardFolderIds = new Set(boardGroups.map((g) => g.id));
    const rootBoards = activeBoards
        .filter((b) => !b.groupId || !boardFolderIds.has(b.groupId))
        .sort((a, b) => a.position - b.position);

    // Space groupings (mesma lógica)
    const spaceGroups = activeGroups.filter(g => g.type === 'space').sort((a, b) => a.position - b.position);
    const spaceFolderIds = new Set(spaceGroups.map((g) => g.id));
    const rootSpaces = activeSpaces
        .filter((s) => !s.groupId || !spaceFolderIds.has(s.groupId))
        .sort((a, b) => a.position - b.position);

    const {
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
    } = useSidebarActions({
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
    });

    return (
        <>
            {groupDetailsOpen && (
                <GroupDetailsModal
                    group={groupDetailsTarget}
                    onClose={() => { setGroupDetailsOpen(false); setGroupDetailsTarget(null); }}
                    onSave={async (updates) => {
                        if (!groupDetailsTarget?.id) return;
                        const groupId = groupDetailsTarget.id;
                        dispatch({ type: 'UPDATE_GROUP', payload: { id: groupId, updates } });
                        dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId: '__folder_ops__', saving: true } });
                        if (suppressRealtime) suppressRealtime(2000);
                        try {
                            const { updateGroup } = await import('../../services/workspaceService');
                            await updateGroup(groupId, updates);
                        } finally {
                            dispatch({ type: 'SET_SAVING_BOARD', payload: { boardId: '__folder_ops__', saving: false } });
                        }
                    }}
                />
            )}
            {isOpen && !isDesktop && <div className="sidebar-overlay" onClick={onClose} />}
            <aside
                ref={sidebarRef}
                className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}
                style={isDesktop ? { width: sidebarWidth } : undefined}
                onClick={(e) => {
                    // Clear selection when clicking empty sidebar space (NOT during drag)
                    if (state.selectedItems?.length > 0 && !state.isDraggingBulk) {
                        const target = e.target;
                        const isInteractive = target.closest('.sidebar-item, .board-item, .sidebar-board-checkbox, .sidebar-group-header, .sidebar-section-btn, .sidebar-new-form, .sidebar-rename-form, .sidebar-section-label, input');
                        if (!isInteractive) {
                            dispatch({ type: 'CLEAR_SELECTION' });
                        }
                    }
                }}
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
                                    onKeyDown={e => { if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderTitle(''); } }}
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
                                    onKeyDown={e => { if (e.key === 'Escape') { setShowNewBoard(false); setNewBoardTitle(''); } }}
                                />
                            </form>
                        )}

                        <div className="sidebar-boards-lists-wrap">
                            <Droppable droppableId="groups-board" type="board-group">
                                {(provided) => (
                                    <div className="sidebar-board-list" {...provided.droppableProps} ref={provided.innerRef} style={boardGroups.length === 0 ? { minHeight: 0 } : undefined}>
                                        {boardGroups.map((group, index) => (
                                            <SidebarGroup
                                                key={group.id}
                                                group={{ ...group, _isNew: recentlyAddedId === group.id }}
                                                index={index}
                                                items={activeBoards.filter(b => b.groupId === group.id).sort((a, b) => a.position - b.position)}
                                                activeView={activeView}
                                                activeBoard={state.activeBoard}
                                                onContextMenu={handleGroupContextMenu}
                                                onToggleSelection={(e) => handleGroupCheckboxClick(e, group, activeBoards.filter(b => b.groupId === group.id))}
                                                selectedItems={state.selectedItems}
                                                editingGroupId={editingGroupId}
                                                editGroupTitle={editGroupTitle}
                                                setEditGroupTitle={setEditGroupTitle}
                                                onRenameSubmit={handleGroupRenameSubmit}
                                                onRename={handleStartGroupRename}
                                                onHeaderClick={handleGroupHeaderClick}
                                                onClickItem={handleGroupExpandToggle}
                                                isLastGroup={index === boardGroups.length - 1 && rootBoards.length > 0}
                                                isJustReordered={lastReorderedIds.includes(group.id)}
                                                renderItem={(board, bIndex) => (
                                                    <Draggable key={board.id} draggableId={board.id} index={bIndex}>
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                className={`sidebar-item board-item ${state.selectedItems?.includes(board.id) ? 'selected' : ''} ${activeView === 'board' && state.activeBoard === board.id ? 'sidebar-item-active' : ''} ${snapshot.isDragging ? 'dragging' : ''} ${state.isDraggingBulk && snapshot.isDragging ? 'dragging-bulk-stack' : ''} ${state.isDraggingBulk && state.selectedItems?.includes(board.id) && !snapshot.isDragging ? 'bulk-hidden' : ''} ${recentlyAddedId === board.id ? 'animate-slide-up-jelly' : ''}`}
                                                                onClick={(e) => handleBoardClick(e, board.id)}
                                                                onContextMenu={(e) => handleBoardContextMenu(e, board)}
                                                                onDoubleClick={() => isDesktop && handleStartRename(board)}
                                                            >
                                                                <div className={`sidebar-item-inner ${lastReorderedIds.includes(board.id) ? 'sidebar-jelly-reorder' : ''}`}>
                                                                <div {...provided.dragHandleProps} className="sidebar-board-drag-handle">
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
                                                                </div>
                                                                <div className="board-item-end">
                                                                    <span className="sidebar-badge-subtle">{board.lists.reduce((acc, l) => acc + l.cards.length, 0)}</span>
                                                                    <button className="board-item-menu-btn" onClick={(e) => { e.stopPropagation(); handleBoardContextMenu(e, board); }} title="Opções">
                                                                        <MoreHorizontal size={13} className="rotate-90" />
                                                                    </button>
                                                                </div>
                                                                {state.isDraggingBulk && snapshot.isDragging && (
                                                                    <BulkDragFollowers count={state.selectedItems.length} items={allItems.filter(i => state.selectedItems.includes(i.id) && i.id !== board.id)} />
                                                                )}
                                                                </div>
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
                                {(provided) => {
                                    const hasFolders = boardGroups.length > 0;
                                    const hasRootItems = rootBoards.length > 0;
                                    return (
                                        <div
                                            className={`sidebar-board-list ${hasFolders ? `sidebar-root-drop-zone ${hasRootItems ? 'sidebar-root-drop-zone--has-items' : 'sidebar-root-drop-zone--empty'}` : ''}`}
                                            {...provided.droppableProps}
                                            ref={provided.innerRef}
                                            style={{
                                                minHeight: hasFolders ? (hasRootItems ? 0 : 4) : 10,
                                                paddingBottom: hasFolders && hasRootItems ? 8 : 0
                                            }}
                                        >
                                            {rootBoards.map((board, index) => (
                                                <Draggable key={board.id} draggableId={board.id} index={index}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            className={`sidebar-item board-item ${activeView === 'board' && state.activeBoard === board.id ? 'sidebar-item-active' : ''} ${state.selectedItems?.includes(board.id) ? 'selected' : ''} ${snapshot.isDragging ? 'dragging' : ''} ${state.isDraggingBulk && snapshot.isDragging ? 'dragging-bulk-stack' : ''} ${state.isDraggingBulk && state.selectedItems?.includes(board.id) && !snapshot.isDragging ? 'bulk-hidden' : ''} ${recentlyAddedId === board.id ? 'animate-slide-up-jelly' : ''}`}
                                                            onClick={(e) => handleBoardClick(e, board.id)}
                                                            onContextMenu={(e) => handleBoardContextMenu(e, board)}
                                                            onDoubleClick={() => isDesktop && handleStartRename(board)}
                                                        >
                                                            <div className={`sidebar-item-inner ${lastReorderedIds.includes(board.id) ? 'sidebar-jelly-reorder' : ''}`}>
                                                            <div {...provided.dragHandleProps} className="sidebar-board-drag-handle">
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
                                                            </div>
                                                            <div className="board-item-end">
                                                                <span className="sidebar-badge-subtle">{board.lists.reduce((acc, l) => acc + l.cards.length, 0)}</span>
                                                                <button className="board-item-menu-btn" onClick={(e) => { e.stopPropagation(); handleBoardContextMenu(e, board); }} title="Opções">
                                                                    <MoreHorizontal size={13} className="rotate-90" />
                                                                </button>
                                                            </div>
                                                            {state.isDraggingBulk && snapshot.isDragging && (
                                                                <BulkDragFollowers count={state.selectedItems.length} items={allItems.filter(i => state.selectedItems.includes(i.id) && i.id !== board.id)} />
                                                            )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    );
                                }}
                            </Droppable>
                        </div>
                    </div>

                    {/* Spaces section */}
                    <div className="sidebar-boards-section" style={{ marginTop: '18px' }}>
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
                                    onKeyDown={e => { if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderTitle(''); } }}
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
                                    onKeyDown={e => { if (e.key === 'Escape') { setShowNewSpace(false); setNewSpaceTitle(''); } }}
                                />
                            </form>
                        )}

                        <div className="sidebar-boards-lists-wrap">
                            <Droppable droppableId="groups-space" type="space-group">
                                {(provided) => (
                                    <div className="sidebar-board-list" {...provided.droppableProps} ref={provided.innerRef} style={spaceGroups.length === 0 ? { minHeight: 0 } : undefined}>
                                        {spaceGroups.map((group, index) => (
                                            <SidebarGroup
                                                key={group.id}
                                                group={{ ...group, _isNew: recentlyAddedId === group.id }}
                                                index={index}
                                                items={activeSpaces.filter(s => s.groupId === group.id).sort((a, b) => a.position - b.position)}
                                                activeView={activeView}
                                                activeBoard={state.activeBoard}
                                                onContextMenu={(e, g) => handleGroupContextMenu(e, g)}
                                                onToggleSelection={(e) => handleGroupCheckboxClick(e, group, activeSpaces.filter(s => s.groupId === group.id))}
                                                selectedItems={state.selectedItems}
                                                editingGroupId={editingGroupId}
                                                editGroupTitle={editGroupTitle}
                                                setEditGroupTitle={setEditGroupTitle}
                                                onRenameSubmit={handleGroupRenameSubmit}
                                                onRename={handleStartGroupRename}
                                                onHeaderClick={handleGroupHeaderClick}
                                                onClickItem={handleGroupExpandToggle}
                                                isLastGroup={index === spaceGroups.length - 1 && rootSpaces.length > 0}
                                                isJustReordered={lastReorderedIds.includes(group.id)}
                                                renderItem={(space, sIndex) => (
                                                    <Draggable key={space.id} draggableId={space.id} index={sIndex}>
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                className={`sidebar-item board-item ${state.selectedItems?.includes(space.id) ? 'selected' : ''} ${activeView === `space-${space.id}` ? 'sidebar-item-active' : ''} ${snapshot.isDragging ? 'dragging' : ''} ${state.isDraggingBulk && snapshot.isDragging ? 'dragging-bulk-stack' : ''} ${state.isDraggingBulk && state.selectedItems?.includes(space.id) && !snapshot.isDragging ? 'bulk-hidden' : ''} ${recentlyAddedId === space.id ? 'animate-slide-up-jelly' : ''}`}
                                                                onClick={(e) => handleSpaceClick(e, space.id)}
                                                                onContextMenu={(e) => handleSpaceContextMenu(e, space)}
                                                            >
                                                                <div className={`sidebar-item-inner ${lastReorderedIds.includes(space.id) ? 'sidebar-jelly-reorder' : ''}`}>
                                                                <div {...provided.dragHandleProps} className="sidebar-board-drag-handle">
                                                                <div
                                                                    className={`sidebar-board-checkbox ${state.selectedItems?.includes(space.id) ? 'selected' : ''}`}
                                                                    title="Selecionar"
                                                                    onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_SELECTION', payload: { id: space.id, type: 'space' } }); }}
                                                                >
                                                                    {state.selectedItems?.includes(space.id) && <Check size={10} strokeWidth={4} />}
                                                                </div>
                                                                <span className="sidebar-board-dot" style={{ background: space.color || '#9b59b6' }} />
                                                                <span className="truncate">{space.emoji} {space.title}</span>
                                                                </div>
                                                                <div className="board-item-end">
                                                                    <button className="board-item-menu-btn" onClick={(e) => { e.stopPropagation(); handleSpaceContextMenu(e, space); }} title="Opções">
                                                                        <MoreHorizontal size={13} />
                                                                    </button>
                                                                </div>
                                                                {state.isDraggingBulk && snapshot.isDragging && (
                                                                    <BulkDragFollowers count={state.selectedItems.length} items={allItems.filter(i => state.selectedItems.includes(i.id) && i.id !== space.id)} />
                                                                )}
                                                                </div>
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
                                {(provided) => {
                                    const hasFolders = spaceGroups.length > 0;
                                    const hasRootItems = rootSpaces.length > 0;
                                    return (
                                        <div
                                            className={`sidebar-board-list ${hasFolders ? `sidebar-root-drop-zone ${hasRootItems ? 'sidebar-root-drop-zone--has-items' : 'sidebar-root-drop-zone--empty'}` : ''}`}
                                            {...provided.droppableProps}
                                            ref={provided.innerRef}
                                            style={{
                                                minHeight: hasFolders ? (hasRootItems ? 0 : 4) : 10,
                                                paddingBottom: hasFolders && hasRootItems ? 8 : 0
                                            }}
                                        >
                                            {rootSpaces.map((space, index) => (
                                                <Draggable key={space.id} draggableId={space.id} index={index}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            className={`sidebar-item board-item ${activeView === `space-${space.id}` ? 'sidebar-item-active' : ''} ${state.selectedItems?.includes(space.id) ? 'selected' : ''} ${snapshot.isDragging ? 'dragging' : ''} ${state.isDraggingBulk && snapshot.isDragging ? 'dragging-bulk-stack' : ''} ${state.isDraggingBulk && state.selectedItems?.includes(space.id) && !snapshot.isDragging ? 'bulk-hidden' : ''} ${recentlyAddedId === space.id ? 'animate-slide-up-jelly' : ''}`}
                                                            onClick={(e) => handleSpaceClick(e, space.id)}
                                                            onContextMenu={(e) => handleSpaceContextMenu(e, space)}
                                                        >
                                                            <div className={`sidebar-item-inner ${lastReorderedIds.includes(space.id) ? 'sidebar-jelly-reorder' : ''}`}>
                                                            <div {...provided.dragHandleProps} className="sidebar-board-drag-handle">
                                                            <div
                                                                className={`sidebar-board-checkbox ${state.selectedItems?.includes(space.id) ? 'selected' : ''}`}
                                                                title="Selecionar"
                                                                onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_SELECTION', payload: { id: space.id, type: 'space' } }); }}
                                                            >
                                                                {state.selectedItems?.includes(space.id) && <Check size={10} strokeWidth={4} />}
                                                            </div>
                                                            <span className="sidebar-board-dot" style={{ background: space.color || '#9b59b6' }} />
                                                            <span className="truncate">{space.emoji} {space.title}</span>
                                                            </div>
                                                            <div className="board-item-end">
                                                                <button className="board-item-menu-btn" onClick={(e) => { e.stopPropagation(); handleSpaceContextMenu(e, space); }} title="Opções">
                                                                    <MoreHorizontal size={13} />
                                                                </button>
                                                            </div>
                                                            {state.isDraggingBulk && snapshot.isDragging && (
                                                                <BulkDragFollowers count={state.selectedItems.length} items={allItems.filter(i => state.selectedItems.includes(i.id) && i.id !== space.id)} />
                                                            )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    );
                                }}
                            </Droppable>
                        </div>
                    </div>

                    {/* RECURSOS section */}
                    <nav className="sidebar-nav" style={{ marginTop: '18px' }}>
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
            {detailsSpace && (
                <SpaceDetailsModal
                    space={detailsSpace}
                    onClose={() => setDetailsSpace(null)}
                />
            )}
        </>
    );
}
