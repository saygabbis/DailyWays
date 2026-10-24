import { useMemo, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
    Sun,
    Star,
    CalendarDays,
    Home,
    ChevronsLeft,
    Settings,
    HelpCircle,
    Timer,
    Radio,
    Users,
    Search,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useApp } from '../../context/useApp';
import { useBoardCollabContext } from '../../collab/board/ops/useBoardCollab';
import { usePomodoro } from '../../context/usePomodoro';
import { useRadio } from '../../context/useRadio';
import { useContextMenu } from '../Common/useContextMenu';
import { useI18n, useTheme } from '../../context/useTheme';
import { useDndHandlers } from '../../dnd/dndRegistry.js';
import { isCardImportant } from '../../utils/cardImportant';
import BoardDetailsModal from '../Board/BoardDetailsModal';
import SpaceDetailsModal from '../Spaces/SpaceDetailsModal';
import GroupDetailsModal from './GroupDetailsModal';
import SidebarTree from './SidebarTree';
import { useResizableSidebar } from './useResizableSidebar';
import { useSidebarActions } from './useSidebarActions';
import logoWhite from '../../assets/Logo - Branco.png';
import logoBlack from '../../assets/Logo - Preto.png';
import './Sidebar.css';

const LIGHT_THEMES = ['light', 'latte', 'ocean', 'nord'];
const cardCount = (board) => board.lists.reduce((acc, l) => acc + l.cards.length, 0);

/** Item do "Hoje". Diário/Importante/Planejado também recebem cards arrastados do board. */
function TodayLink({ item, active, onClick }) {
    const { setNodeRef, isOver, active: dragActive } = useDroppable({
        id: `zone:${item.id}`,
        data: { kind: 'zone', zone: item.id },
        disabled: !item.drop,
    });
    const cardOver = isOver && dragActive?.data?.current?.kind === 'card';
    return (
        <li ref={setNodeRef}>
            <button
                type="button"
                className={`sb-nav ${active ? 'is-active' : ''} ${cardOver ? 'dw-drop-target is-drop' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => onClick(item.id)}
            >
                <item.icon size={17} className="sb-nav-icon" aria-hidden />
                <span className="sb-item-title">{item.label}</span>
                {cardOver ? (
                    <span className="sb-drop-hint">{item.dropHint}</span>
                ) : (
                    item.count > 0 && <span className="sb-count" aria-label={`${item.count} tarefas`}>{item.count}</span>
                )}
            </button>
        </li>
    );
}

/**
 * Navegação lateral. Três partes:
 *  1. Hoje — Início, Diário, Importante, Planejado (os 3 últimos aceitam cards arrastados);
 *  2. Seus boards e spaces — pastas e itens, reordenáveis por arraste, com criação rápida;
 *  3. Rodapé FIXO — ferramentas (Foco, Rádio) e Contatos, Configurações, Ajuda.
 */
export default function Sidebar({ activeView, onViewChange, isOpen, onClose, isDesktop, onOpenSearch, onPlannedDrop }) {
    const { user, logout } = useAuth();
    const boardCollab = useBoardCollabContext();
    const {
        state, dispatch, getMyDayCards, getImportantCards, getPlannedCards,
        DEFAULT_BOARD_COLORS, suppressRealtime, showConfirm, reloadBoards,
        lastReorderedIds = [], setLastReorderedIds, updateWorkspaceOrder,
    } = useApp();
    const t = useI18n();
    const { theme } = useTheme();
    const { toggleOpen: togglePomodoro, isOpen: pomodoroOpen } = usePomodoro();
    const { toggleOpen: toggleRadio, isOpen: radioOpen } = useRadio();
    const { showContextMenu } = useContextMenu();
    const { collabDispatchForBoard } = boardCollab || {};

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

    const boards = state.boards || [];
    const spaces = state.spaces || [];
    const groups = state.groups || [];
    const selectedIds = state.selectedItems || [];
    const selectionMode = selectedIds.length > 0;

    const tree = useMemo(() => {
        const build = (type, items) => {
            const folders = groups.filter((g) => g.type === type).sort((a, b) => a.position - b.position);
            const folderIds = new Set(folders.map((g) => g.id));
            // Item com pasta de OUTRO usuário (board compartilhado) aparece na raiz.
            const normalized = items.map((i) => (i.groupId && !folderIds.has(i.groupId) ? { ...i, groupId: null } : i));
            const root = normalized.filter((i) => !i.groupId).sort((a, b) => a.position - b.position);
            return { folders, items: normalized, root };
        };
        return { board: build('board', boards), space: build('space', spaces) };
    }, [boards, spaces, groups]);

    const {
        createBoard, createFolder, createSpace,
        handleStartGroupRename, handleGroupRenameSubmit, handleGroupHeaderClick,
        handleBoardClick, handleSpaceClick, handleNavClick,
        handleStartRename, handleRenameSubmit,
        handleSpaceContextMenu, handleGroupContextMenu, handleBoardContextMenu,
    } = useSidebarActions({
        onViewChange, onClose, isDesktop, user, logout, boardCollab, state, dispatch,
        DEFAULT_BOARD_COLORS, suppressRealtime, showConfirm, reloadBoards, setLastReorderedIds,
        t, showContextMenu,
        setEditingBoardId, editBoardTitle, setEditBoardTitle,
        setEditingGroupId, editGroupTitle, setEditGroupTitle,
        setRecentlyAddedId, setGroupDetailsOpen, setGroupDetailsTarget, setDetailsBoard, setDetailsSpace,
    });

    const todayItems = [
        { id: 'dashboard', label: t.dashboard || 'Início', icon: Home },
        { id: 'myday', label: t.myday, icon: Sun, count: getMyDayCards().length, drop: true, dropHint: 'Para hoje' },
        { id: 'important', label: t.important, icon: Star, count: getImportantCards().length, drop: true, dropHint: 'Importante' },
        { id: 'planned', label: t.planned, icon: CalendarDays, count: getPlannedCards().length, drop: true, dropHint: 'Escolher data' },
    ];

    // ── Arrastar na sidebar (reordenar/mover para pasta) e soltar cards nas zonas do "Hoje" ──
    const findCard = (cardId) => {
        for (const b of boards) {
            for (const l of b.lists) {
                const card = l.cards.find((c) => c.id === cardId);
                if (card) return { card, boardId: b.id, listId: l.id };
            }
        }
        return null;
    };

    useDndHandlers({
        zone: {
            accepts: (activeData) => activeData?.kind === 'card',
            onDrop: (activeData, overData) => {
                const found = findCard(activeData.cardId);
                if (!found) return;
                const { card, boardId, listId } = found;
                const update = (updates) => collabDispatchForBoard?.(boardId, {
                    type: 'UPDATE_CARD',
                    payload: { boardId, listId, cardId: card.id, updates },
                });
                if (overData.zone === 'myday' && !card.myDay) update({ myDay: true });
                if (overData.zone === 'important' && !isCardImportant(card)) update({ priority: 'high' });
                if (overData.zone === 'planned') onPlannedDrop?.({ card, boardId, listId });
            },
        },
        'nav-item': {
            onEnd: ({ active, over }) => {
                const from = active.data.current;
                const to = over?.data?.current;
                if (!to) return;
                const branch = tree[from.itemType];
                const listName = from.itemType === 'board' ? 'boards' : 'spaces';
                const containerItems = (groupId) => (groupId
                    ? branch.items.filter((i) => i.groupId === groupId).sort((a, b) => a.position - b.position)
                    : branch.root);
                let destGroupId;
                let destIndex;
                if (to.kind === 'nav-item') {
                    if (to.itemId === from.itemId) return;
                    destGroupId = to.groupId ?? null;
                    destIndex = Math.max(0, containerItems(destGroupId).findIndex((i) => i.id === to.itemId));
                } else if (to.kind === 'nav-folder' || to.kind === 'nav-root') {
                    destGroupId = to.groupId ?? null;
                    destIndex = containerItems(destGroupId).filter((i) => i.id !== from.itemId).length;
                } else {
                    return;
                }
                if ((from.groupId ?? null) === destGroupId
                    && containerItems(destGroupId).findIndex((i) => i.id === from.itemId) === destIndex) return;
                updateWorkspaceOrder(listName, from.itemId, from.groupId ?? null, destGroupId, destIndex);
            },
            renderOverlay: (data) => (
                <div className="sb-drag-chip">
                    <span aria-hidden>{data.emoji || '•'}</span>
                    <span className="sb-item-title">{data.title}</span>
                    {selectedIds.includes(data.itemId) && selectedIds.length > 1 && (
                        <span className="sb-count is-strong">+{selectedIds.length - 1}</span>
                    )}
                </div>
            ),
            announce: (type, a, o) => ({
                start: `Pegou ${a?.title}.`,
                over: o?.kind === 'nav-folder' ? `Sobre a pasta ${o.title}.` : o?.title ? `Perto de ${o.title}.` : undefined,
                end: `${a?.title} reposicionado.`,
                cancel: 'Movimento cancelado.',
            })[type],
        },
        'nav-folder': {
            onEnd: ({ active, over }) => {
                const from = active.data.current;
                const to = over?.data?.current;
                if (to?.kind !== 'nav-folder' || to.groupId === from.groupId) return;
                const all = [...groups].sort((a, b) => a.position - b.position);
                const destIndex = all.findIndex((g) => g.id === to.groupId);
                if (destIndex >= 0) updateWorkspaceOrder('groups', from.groupId, null, null, destIndex);
            },
            renderOverlay: (data) => (
                <div className="sb-drag-chip is-folder"><span className="sb-item-title">📁 {data.title}</span></div>
            ),
        },
    });

    const renamingBoard = {
        id: editingBoardId,
        value: editBoardTitle,
        onChange: setEditBoardTitle,
        onSubmit: handleRenameSubmit,
        onCancel: () => setEditingBoardId(null),
    };
    const renamingFolder = {
        id: editingGroupId,
        value: editGroupTitle,
        onChange: setEditGroupTitle,
        onSubmit: handleGroupRenameSubmit,
    };
    const toggleSelect = (type) => (item) => dispatch({ type: 'TOGGLE_SELECTION', payload: { id: item.id, type } });
    const isLight = LIGHT_THEMES.includes(theme);

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
                        if (suppressRealtime) suppressRealtime(2000);
                        const { updateGroup } = await import('../../services/workspaceService');
                        await updateGroup(groupId, updates);
                    }}
                />
            )}
            {isOpen && !isDesktop && <div className="sb-scrim" onClick={onClose} aria-hidden />}
            <aside
                ref={sidebarRef}
                className={`sidebar sb ${isOpen ? 'sidebar-open is-open' : ''}`}
                style={isDesktop ? { width: sidebarWidth } : undefined}
                aria-label="Navegação principal"
                onClick={(e) => {
                    if (selectionMode && !state.isDraggingBulk && !e.target.closest('.sb-item, .sb-folder, input, button')) {
                        dispatch({ type: 'CLEAR_SELECTION' });
                    }
                }}
            >
                <div className="sb-top">
                    <div className="sb-brand">
                        <img src={isLight ? logoBlack : logoWhite} alt="" className="sb-brand-logo" />
                        <span className="sb-brand-name">DailyWays</span>
                    </div>
                    <button type="button" className="sb-icon-btn" onClick={onClose} aria-label="Recolher navegação" title="Recolher (Ctrl+B)">
                        <ChevronsLeft size={18} />
                    </button>
                </div>

                <button type="button" className="sb-search" onClick={() => { onOpenSearch?.(); if (!isDesktop) onClose?.(); }}>
                    <Search size={15} aria-hidden />
                    <span>Buscar</span>
                    <kbd>Ctrl K</kbd>
                </button>

                <div className="sb-scroll">
                    <nav aria-label="Hoje" className="sb-today">
                        <ul className="sb-list">
                            {todayItems.map((item) => (
                                <TodayLink key={item.id} item={item} active={activeView === item.id} onClick={handleNavClick} />
                            ))}
                        </ul>
                    </nav>

                    <SidebarTree
                        itemType="board"
                        title={t.boards || 'Boards'}
                        groups={tree.board.folders}
                        items={tree.board.items}
                        rootItems={tree.board.root}
                        activeId={activeView === 'board' ? state.activeBoard : null}
                        selectedIds={selectedIds}
                        selectionMode={selectionMode && state.selectionType === 'board'}
                        recentlyAddedId={recentlyAddedId || lastReorderedIds[0]}
                        countFor={cardCount}
                        renaming={renamingBoard}
                        folderRenaming={renamingFolder}
                        onOpenItem={handleBoardClick}
                        onToggleSelect={toggleSelect('board')}
                        onItemMenu={handleBoardContextMenu}
                        onFolderMenu={handleGroupContextMenu}
                        onFolderToggle={(g, e) => (e ? handleGroupHeaderClick(e, g) : handleGroupHeaderClick({}, g))}
                        onStartRename={(item) => isDesktop && handleStartRename(item)}
                        onCreateItem={(name, groupId) => createBoard(name, groupId)}
                        onCreateFolder={(name) => createFolder(name, 'board')}
                    />

                    <SidebarTree
                        itemType="space"
                        title="Spaces"
                        groups={tree.space.folders}
                        items={tree.space.items}
                        rootItems={tree.space.root}
                        activeId={activeView.startsWith('space-') ? activeView.slice(6) : null}
                        selectedIds={selectedIds}
                        selectionMode={selectionMode && state.selectionType === 'space'}
                        recentlyAddedId={recentlyAddedId}
                        folderRenaming={renamingFolder}
                        onOpenItem={handleSpaceClick}
                        onToggleSelect={toggleSelect('space')}
                        onItemMenu={handleSpaceContextMenu}
                        onFolderMenu={handleGroupContextMenu}
                        onFolderToggle={(g, e) => (e ? handleGroupHeaderClick(e, g) : handleGroupHeaderClick({}, g))}
                        onCreateItem={(name, groupId) => createSpace(name, groupId)}
                        onCreateFolder={(name) => createFolder(name, 'space')}
                    />
                </div>

                <footer className="sb-foot">
                    <div className="sb-tools" role="group" aria-label="Ferramentas">
                        <button type="button" className={`sb-tool ${pomodoroOpen ? 'is-on' : ''}`} aria-pressed={Boolean(pomodoroOpen)} onClick={togglePomodoro}>
                            <Timer size={15} aria-hidden /> <span>{t.focusMode || 'Foco'}</span>
                        </button>
                        <button type="button" className={`sb-tool ${radioOpen ? 'is-on' : ''}`} aria-pressed={Boolean(radioOpen)} onClick={toggleRadio}>
                            <Radio size={15} aria-hidden /> <span>{t.radio || 'Rádio'}</span>
                        </button>
                    </div>
                    <ul className="sb-list">
                        {[
                            { id: 'contacts', label: 'Contatos', icon: Users },
                            { id: 'settings', label: t.settings, icon: Settings },
                            { id: 'help', label: t.help || 'Ajuda', icon: HelpCircle },
                        ].map((item) => (
                            <li key={item.id}>
                                <button
                                    type="button"
                                    className={`sb-nav is-quiet ${activeView === item.id ? 'is-active' : ''}`}
                                    aria-current={activeView === item.id ? 'page' : undefined}
                                    onClick={() => handleNavClick(item.id)}
                                >
                                    <item.icon size={16} className="sb-nav-icon" aria-hidden />
                                    <span className="sb-item-title">{item.label}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </footer>

                {isDesktop && <div className="sb-resize" onMouseDown={handleMouseDown} role="separator" aria-orientation="vertical" aria-label="Largura da navegação" />}
            </aside>

            {detailsBoard && <BoardDetailsModal board={detailsBoard} onClose={() => setDetailsBoard(null)} />}
            {detailsSpace && <SpaceDetailsModal space={detailsSpace} onClose={() => setDetailsSpace(null)} />}
        </>
    );
}
