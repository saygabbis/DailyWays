import { useState, useRef, useEffect, useLayoutEffect, useCallback, useImperativeHandle, forwardRef, useMemo } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import BoardList from './BoardList';
import ListDetailsModal from './ListDetailsModal';
import BoardDetailsModal from '../Sidebar/BoardDetailsModal';
import { Plus, Loader2, X, GripVertical, Share2 } from 'lucide-react';
import { fetchBoardMembers, sortBoardMembersOwnerFirst } from '../../services/boardService';
import { useMergedBoardEditors } from '../../hooks/useMergedBoardEditors';
import BoardCollabStatusBanner from '../../collab/BoardCollabStatusBanner.jsx';
import CollabPresenceLayer from '../../collab/CollabPresenceLayer.jsx';
import { isPeerOnBoardSurface } from '../../collab/presenceVisibility.js';
import RemoteDragLayer from '../../collab/RemoteDragLayer.jsx';
import PresenceOnlineList from '../../collab/PresenceOnlineList.jsx';
import { setLastBoardPointer } from '../../collab/lastBoardPointer.js';
import { useCollab } from '../../collab/CollabContext.jsx';
import { scheduleBoardPresencePublish, prepareBoardSurfacePresence } from '../../collab/boardPresencePublish.js';
import { announcePresence } from '../../collab/presenceBridge.js';
import { useBoardPresenceHighlights } from '../../hooks/useBoardPresenceHighlights';
import { useBoardCollabDispatch } from '../../collab/BoardCollabContext.jsx';
import { useCollabPresence } from '../../collab/useCollabPresence.js';
import { uuidv4 } from '../../utils/uuid';
import './Board.css';

/** Zona do menu de perfil (viewport): padding horizontal + respiro por baixo do dropdown (como na zona vermelha). */
const PROFILE_MENU_ZONE_PAD_X = 8;
const PROFILE_MENU_ZONE_PAD_BELOW = 16;
/** Espaço visível entre o fundo do dropdown e o topo da toolbar (px). */
const PROFILE_MENU_GAP_AFTER_ZONE = 20;

/** Mínimos para interseção antes do layout medir a toolbar (offsetWidth 0 não pode virar largura 1px). */
const TOOLBAR_SYNTHETIC_MIN_W = 300;
const TOOLBAR_SYNTHETIC_MIN_H = 48;

/**
 * Posição da toolbar em viewport para interseção com o menu de perfil (sintético).
 * `narrowLayout`: canto inferior direito do board (mobile); senão canto superior direito (desktop).
 */
function getToolbarSyntheticViewportRect(boardRect, toolbarPos, toolbarW, toolbarH, narrowLayout) {
    if (toolbarPos != null) {
        const w = Math.max(toolbarW || 0, 1);
        const h = Math.max(toolbarH || 0, 1);
        return {
            left: boardRect.left + toolbarPos.x,
            top: boardRect.top + toolbarPos.y,
            right: boardRect.left + toolbarPos.x + w,
            bottom: boardRect.top + toolbarPos.y + h,
        };
    }
    const w = Math.max(toolbarW || 0, TOOLBAR_SYNTHETIC_MIN_W);
    const h = Math.max(toolbarH || 0, TOOLBAR_SYNTHETIC_MIN_H);
    if (narrowLayout) {
        const pad = 12;
        const right = boardRect.right - pad;
        const bottom = boardRect.bottom - pad;
        return {
            left: right - w,
            top: bottom - h,
            right,
            bottom,
        };
    }
    const right = boardRect.right - 20;
    const top = boardRect.top + 20;
    return {
        left: right - w,
        top,
        right,
        bottom: top + h,
    };
}

function rectsIntersect(a, b) {
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

function BoardView({ onCardClick, focusedCardId = null }, ref) {
    const { state, getActiveBoard, dispatch, isSavingBoard, showBoardToolbar, profileMenuOpen } = useApp();
    const { user, profile } = useAuth();
    const collab = useCollab();
    const [addingList, setAddingList] = useState(false);
    const [newListTitle, setNewListTitle] = useState('');
    const [listDetails, setListDetails] = useState(null);
    const [droppedListId, setDroppedListId] = useState(null);
    const [showShareModal, setShowShareModal] = useState(false);
    const [toolbarMembers, setToolbarMembers] = useState([]);
    const [toolbarMembersLoading, setToolbarMembersLoading] = useState(false);
    const [narrowBoardLayout, setNarrowBoardLayout] = useState(
        () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
    );

    // Floating Toolbar State
    const [toolbarPos, setToolbarPos] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
    const toolbarRef = useRef(null);
    const containerRef = useRef(null);

    // Reset position when shown
    useEffect(() => {
        if (!showBoardToolbar) {
            setToolbarPos(null);
        }
    }, [showBoardToolbar]);

    useEffect(() => {
        const mq = window.matchMedia('(max-width: 768px)');
        const onChange = () => setNarrowBoardLayout(mq.matches);
        onChange();
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    const board = getActiveBoard();
    const editorsByCardId = useMergedBoardEditors(focusedCardId, board?.id);
    const { collabDispatch, connected: collabConnected } = useBoardCollabDispatch(board?.id);
    const {
        updateCursor: updateBoardCursor,
        setHoverTarget,
        clearHoverTarget,
    } = useCollabPresence(board?.id, { mode: 'screen' });

    useEffect(() => {
        if (!board?.id || !collab?.socket?.connected) return undefined;
        prepareBoardSurfacePresence(board.id);
        const auth = { user, profile };
        const publish = () => scheduleBoardPresencePublish(collab.socket, board.id, auth);
        publish();
        const raf = requestAnimationFrame(publish);
        announcePresence(board.id);
        return () => cancelAnimationFrame(raf);
    }, [board?.id, collab?.socket, collab?.connected, user?.id, profile]);

    const { hoverByCardId, hoverByListId, remoteDrags } = useBoardPresenceHighlights();
    const remoteDraggingCardIds = useMemo(
        () => new Set(remoteDrags.map((d) => d.cardId)),
        [remoteDrags],
    );

    // Board partilhado: mostrar toolbar por defeito (o utilizador pode fechar; persistimos por board)
    useEffect(() => {
        if (!board?.id || !user?.id) return;
        const dismissed = localStorage.getItem(`dailyways_board_toolbar_dismissed_${board.id}`);
        if (dismissed === '1') return;
        let cancelled = false;
        (async () => {
            const { data } = await fetchBoardMembers(board.id);
            if (cancelled) return;
            const members = data || [];
            const shared = members.length > 1 || (board.ownerId && board.ownerId !== user.id);
            if (shared) {
                dispatch({ type: 'TOGGLE_BOARD_TOOLBAR', payload: true });
            }
        })();
        return () => { cancelled = true; };
    }, [board?.id, board?.ownerId, user?.id, dispatch]);

    // Load board members for toolbar avatars
    useEffect(() => {
        if (!showBoardToolbar || !board?.id) return;
        let cancelled = false;
        (async () => {
            setToolbarMembersLoading(true);
            const { data, error } = await fetchBoardMembers(board.id);
            if (cancelled) return;
            if (error) {
                setToolbarMembers([]);
            } else {
                const list = Array.isArray(data) ? data : [];
                setToolbarMembers(sortBoardMembersOwnerFirst(list, board.ownerId));
            }
            setToolbarMembersLoading(false);
        })();
        return () => { cancelled = true; };
    }, [showBoardToolbar, board?.id, board?.ownerId]);

    const toolbarVisibleMembers = toolbarMembers.slice(0, 4);
    const toolbarExtraCount = Math.max(0, toolbarMembers.length - 4);


    // ── Panning Logic ──
    const scrollerRef = useRef(null);
    const [isPanning, setIsPanning] = useState(false);
    const panningData = useRef({
        isDown: false,
        startX: 0,
        scrollLeft: 0,
        moved: false
    });

    // Pan horizontal só com mouse — no touch o scroll nativo do .board-scroller não conflita com o DnD
    const handlePanPointerDown = (e) => {
        if (e.pointerType !== 'mouse') return;
        if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
        const target = e.target;
        const isInteractive = target.closest('button, a, input, textarea, .board-card, .board-list-header, .board-list-footer');
        if (isInteractive) return;

        panningData.current = {
            isDown: true,
            startX: e.pageX,
            scrollLeft: scrollerRef.current.scrollLeft,
            moved: false
        };
        setIsPanning(true);
        if (e.button === 1) e.preventDefault();

        const onMove = (ev) => {
            if (ev.pointerType !== 'mouse' || !panningData.current.isDown) return;
            ev.preventDefault();
            const walk = (ev.pageX - panningData.current.startX) * 1;
            scrollerRef.current.scrollLeft = panningData.current.scrollLeft - walk;
            if (Math.abs(walk) > 5) panningData.current.moved = true;
        };
        const onUp = () => {
            panningData.current.isDown = false;
            setIsPanning(false);
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            document.removeEventListener('pointercancel', onUp);
        };
        document.addEventListener('pointermove', onMove, { passive: false });
        document.addEventListener('pointerup', onUp);
        document.addEventListener('pointercancel', onUp);
    };

    const handleContextMenu = (e) => {
        // Prevent context menu if we just panned with right click
        if (panningData.current.moved) {
            e.preventDefault();
            panningData.current.moved = false; // Reset
        }
    };

    const handleDragEnd = useCallback((result) => {
        const b = getActiveBoard();
        if (!b) return;

        const { source, destination, type, draggableId } = result;
        if (!destination) return;
        if (source.droppableId === destination.droppableId && source.index === destination.index) return;

        // Handle List Reordering
        if (type === 'list') {
            const movedListId = b.lists[source.index]?.id;
            collabDispatch({
                type: 'MOVE_LIST',
                payload: {
                    boardId: b.id,
                    listId: movedListId,
                    sourceIndex: source.index,
                    destIndex: destination.index,
                    userId: state.user?.id
                }
            });
            // Anima a lista que foi solta
            if (movedListId) {
                setDroppedListId(movedListId);
                setTimeout(() => setDroppedListId(null), 900);
            }
            return;
        }

        // Handle Card Movement (use draggableId — indices break when list is filtered)
        const sourceList = b.lists.find(l => l.id === source.droppableId);
        const destList = b.lists.find(l => l.id === destination.droppableId);
        if (!sourceList || !destList) return;

        const cardId = draggableId;
        const sourceIndex = sourceList.cards.findIndex((c) => c.id === cardId);
        if (sourceIndex < 0) return;

        const movedCard = sourceList.cards[sourceIndex];
        const destIndex = destination.index;

        collabDispatch({
            type: 'MOVE_CARD',
            payload: {
                boardId: b.id,
                cardId: movedCard.id,
                sourceListId: source.droppableId,
                destListId: destination.droppableId,
                sourceIndex,
                destIndex,
            },
        });

        if (destList?.isCompletionList && movedCard) {
            const allSubtasksDone = movedCard.subtasks?.every(st => st.done);
            if (!movedCard.completed || !allSubtasksDone) {
                collabDispatch({
                    type: 'UPDATE_CARD',
                    payload: {
                        boardId: b.id,
                        listId: destination.droppableId,
                        cardId: movedCard.id,
                        updates: {
                            completed: true,
                            subtasks: (movedCard.subtasks || []).map(st => ({ ...st, done: true })),
                        },
                    },
                });
            }
        }

    }, [getActiveBoard, collabDispatch, state.user?.id]);

    // Expose handleDragEnd so the parent App can call it from a unified DragDropContext
    useImperativeHandle(ref, () => ({
        handleDragEnd,
    }), [handleDragEnd]);

    const handleSaveListDetails = (updates) => {
        if (!listDetails) return;
        collabDispatch({ type: 'UPDATE_LIST', payload: { boardId: board.id, listId: listDetails.id, updates } });
        setListDetails(null);
    };

    const handleAddList = async (e) => {
        e.preventDefault();
        if (!newListTitle.trim()) return;
        collabDispatch({ type: 'ADD_LIST', payload: { boardId: board.id, title: newListTitle, id: uuidv4() } });
        setNewListTitle('');
        setAddingList(false);

    };

    // Draggable Logic
    const handleToolbarPointerDown = (e) => {
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('a')) return;
        if (!e.isPrimary) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        let currentX = toolbarPos?.x;
        let currentY = toolbarPos?.y;

        if (currentX === undefined || currentY === undefined) {
            const rect = toolbarRef.current.getBoundingClientRect();
            const containerRect = containerRef.current.getBoundingClientRect();
            currentX = rect.left - containerRect.left;
            currentY = rect.top - containerRect.top;
        }

        dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            posX: currentX,
            posY: currentY
        };
        setIsDragging(true);
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch (_) { /* noop */ }
    };

    const handleToolbarPointerUpGlobal = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        const handleMove = (e) => {
            if (!isDragging) return;
            const deltaX = e.clientX - dragStartRef.current.x;
            const deltaY = e.clientY - dragStartRef.current.y;

            let newX = dragStartRef.current.posX + deltaX;
            let newY = dragStartRef.current.posY + deltaY;

            const width = toolbarRef.current?.offsetWidth || 300;
            const height = toolbarRef.current?.offsetHeight || 50;
            const containerWidth = containerRef.current?.offsetWidth || window.innerWidth;
            const containerHeight = containerRef.current?.offsetHeight || window.innerHeight;
            const padding = 10;

            newX = Math.max(padding, Math.min(newX, containerWidth - width - padding));
            newY = Math.max(padding, Math.min(newY, containerHeight - height - padding));

            setToolbarPos({ x: newX, y: newY });
        };

        if (isDragging) {
            document.addEventListener('pointermove', handleMove, { passive: false });
            document.addEventListener('pointerup', handleToolbarPointerUpGlobal);
            document.addEventListener('pointercancel', handleToolbarPointerUpGlobal);
        }
        return () => {
            document.removeEventListener('pointermove', handleMove);
            document.removeEventListener('pointerup', handleToolbarPointerUpGlobal);
            document.removeEventListener('pointercancel', handleToolbarPointerUpGlobal);
        };
    }, [isDragging, handleToolbarPointerUpGlobal]);

    const [profileMenuAvoidMinTop, setProfileMenuAvoidMinTop] = useState(null);

    useLayoutEffect(() => {
        if (!profileMenuOpen || !showBoardToolbar) {
            setProfileMenuAvoidMinTop(null);
            return;
        }
        const run = () => {
            const boardEl = containerRef.current;
            const menuEl = document.querySelector('.header-profile-dropdown');
            const toolEl = toolbarRef.current;
            if (!boardEl || !menuEl) {
                setProfileMenuAvoidMinTop(null);
                return;
            }
            const boardRect = boardEl.getBoundingClientRect();
            const menuRect = menuEl.getBoundingClientRect();
            const rawW = toolEl?.offsetWidth || 0;
            const rawH = toolEl?.offsetHeight || 0;
            const tw = toolbarPos != null
                ? Math.max(rawW, 1)
                : Math.max(rawW, TOOLBAR_SYNTHETIC_MIN_W);
            const th = toolbarPos != null
                ? Math.max(rawH, 1)
                : Math.max(rawH, TOOLBAR_SYNTHETIC_MIN_H);
            const toolRect = getToolbarSyntheticViewportRect(boardRect, toolbarPos, tw, th, narrowBoardLayout);
            const zone = {
                left: menuRect.left - PROFILE_MENU_ZONE_PAD_X,
                right: menuRect.right + PROFILE_MENU_ZONE_PAD_X,
                top: menuRect.top,
                bottom: menuRect.bottom + PROFILE_MENU_ZONE_PAD_BELOW,
            };

            if (!rectsIntersect(toolRect, zone)) {
                setProfileMenuAvoidMinTop(null);
                return;
            }
            setProfileMenuAvoidMinTop(zone.bottom + PROFILE_MENU_GAP_AFTER_ZONE - boardRect.top);
        };

        run();
        const id = requestAnimationFrame(run);
        window.addEventListener('resize', run);
        return () => {
            cancelAnimationFrame(id);
            window.removeEventListener('resize', run);
        };
    }, [profileMenuOpen, showBoardToolbar, toolbarPos?.x, toolbarPos?.y, board?.id, narrowBoardLayout]);

    const toolbarDefaultBottomCorner = narrowBoardLayout && toolbarPos == null && profileMenuAvoidMinTop == null;

    const toolbarComputedTop = useMemo(() => {
        if (toolbarPos != null) {
            if (profileMenuAvoidMinTop == null) return toolbarPos.y;
            return Math.max(toolbarPos.y, profileMenuAvoidMinTop);
        }
        if (profileMenuAvoidMinTop != null) return profileMenuAvoidMinTop;
        return undefined;
    }, [profileMenuAvoidMinTop, toolbarPos]);

    if (!board) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <h2>Nenhum board selecionado</h2>
                <p>Selecione ou crie um board na sidebar para começar</p>
            </div>
        );
    }

    const handleBoardPointerMove = useCallback((e) => {
        const el = scrollerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left + el.scrollLeft;
        const y = e.clientY - rect.top + el.scrollTop;
        const cursorScreen = { x: e.clientX, y: e.clientY };
        if (board?.id) {
            setLastBoardPointer(board.id, { x, y, cursorScreen });
        }
        updateBoardCursor({
            x,
            y,
            cursorScreen,
            selectedCardId: null,
        });
    }, [updateBoardCursor, board?.id]);

    const handleCardHover = useCallback((cardId) => {
        setHoverTarget({ cardId, listId: null });
    }, [setHoverTarget]);

    const handleListHover = useCallback((listId) => {
        setHoverTarget({ listId, cardId: null });
    }, [setHoverTarget]);

    const handlePresenceHoverEnd = useCallback(() => {
        clearHoverTarget();
    }, [clearHoverTarget]);

    return (
        <div
            className="board-view"
            ref={containerRef}
            onPointerMove={handleBoardPointerMove}
        >
            <BoardCollabStatusBanner />
            {/* Board Toolbar - Floating & Draggable */}
            {showBoardToolbar && (
                <div
                    ref={toolbarRef}
                    className={`board-toolbar floating animate-slide-down ${isDragging ? 'dragging' : ''} ${toolbarDefaultBottomCorner ? 'board-toolbar--default-bottom' : ''}`}
                    style={{
                        left: toolbarPos != null ? toolbarPos.x : undefined,
                        top: toolbarComputedTop,
                        right: toolbarPos != null ? 'auto' : undefined,
                        bottom: toolbarPos != null ? 'auto' : undefined,
                        position: 'absolute',
                        transition: isDragging ? 'none' : 'opacity 0.2s ease, transform 0.2s ease, top 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        touchAction: isDragging ? 'none' : undefined,
                    }}
                    onPointerDown={handleToolbarPointerDown}
                >
                    <div className="board-toolbar-handle">
                        <GripVertical size={14} />
                    </div>
                    {isSavingBoard(board.id) && (
                        <div className="board-toolbar-section">
                            <span className="board-saving-indicator" title="Salvando alterações no servidor...">
                                <Loader2 size={13} className="spinning" />
                            </span>
                        </div>
                    )}
                    {collabConnected && (
                        <div className="board-toolbar-section board-toolbar-live">
                            <PresenceOnlineList />
                        </div>
                    )}
                    {showBoardToolbar && (
                        <div className="board-toolbar-section board-toolbar-members" aria-label="Membros do board">
                            {toolbarMembersLoading ? (
                                <span className="board-toolbar-members-loading" aria-hidden>
                                    <Loader2 size={16} className="spinning" />
                                </span>
                            ) : toolbarMembers.length > 0 ? (
                                    <div className="board-members">
                                        {toolbarVisibleMembers.map((m) => (
                                            <div
                                                key={m.userId}
                                                className={`board-avatar ${m.photoUrl ? 'has-photo' : ''}`}
                                                role="button"
                                                tabIndex={0}
                                                title="Compartilhar board"
                                                onPointerDown={(e) => e.stopPropagation()}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowShareModal(true);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setShowShareModal(true);
                                                    }
                                                }}
                                            >
                                                {m.photoUrl ? (
                                                    <>
                                                        <img
                                                            src={m.photoUrl}
                                                            alt={m.name || m.username}
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                                            onError={(e) => {
                                                                const img = e.currentTarget;
                                                                const wrap = img.closest('.board-avatar');
                                                                const fallback = wrap?.querySelector('.board-avatar-fallback');
                                                                if (fallback) fallback.style.display = 'flex';
                                                                img.style.display = 'none';
                                                            }}
                                                        />
                                                        <span className="board-avatar-fallback hidden">
                                                            {(m.name || m.username || '?')[0]}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="board-avatar-initial">{(m.name || m.username || '?')[0]}</span>
                                                )}
                                            </div>
                                        ))}
                                        {toolbarExtraCount > 0 && (
                                            <div
                                                className="board-avatar-more"
                                                role="button"
                                                tabIndex={0}
                                                title="Compartilhar board"
                                                onPointerDown={(e) => e.stopPropagation()}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowShareModal(true);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setShowShareModal(true);
                                                    }
                                                }}
                                            >
                                                +
                                            </div>
                                        )}
                                    </div>
                                ) : null}
                        </div>
                    )}
                    <button
                        className="btn-icon-xs"
                        onClick={() => setShowShareModal(true)}
                        title="Compartilhar board"
                    >
                        <Share2 size={14} />
                    </button>
                    <button
                        className="btn-icon-xs toolbar-close-btn"
                        onClick={() => {
                            dispatch({ type: 'TOGGLE_BOARD_TOOLBAR', payload: false });
                            if (board?.id) localStorage.setItem(`dailyways_board_toolbar_dismissed_${board.id}`, '1');
                        }}
                        title="Fechar toolbar"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            <div
                className={`board-scroller ${isPanning ? 'is-panning' : ''}`}
                ref={scrollerRef}
                onPointerMove={handleBoardPointerMove}
                onPointerDown={handlePanPointerDown}
                onContextMenu={handleContextMenu}
            >
                <>
                    <Droppable droppableId="board" direction="horizontal" type="list">
                        {(provided) => (
                            <div
                                className="board-lists"
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                            >
                                {(() => {
                                    // Stagger dinâmico: janela total = min(n * 55ms, 275ms).
                                    // 55ms entre cada lista → painel vazio visível por menos tempo,
                                    // mas ainda percetível a cascata (2 listas = 0/55ms, 6 = 0..275ms).
                                    const n = board.lists.length;
                                    const staggerWindow = Math.min(n * 55, 275);
                                    const step = n > 1 ? staggerWindow / (n - 1) : 0;
                                    const addListDelay = staggerWindow + 40;

                                    return (
                                        <>
                                            {board.lists.map((list, index) => (
                                                <Draggable key={list.id} draggableId={list.id} index={index}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            className={`board-list-wrapper ${snapshot.isDragging ? 'list-dragging' : ''}`}
                                                            style={{
                                                                ...provided.draggableProps.style,
                                                            }}
                                                        >
                                                            <BoardList
                                                                list={list}
                                                                boardId={board.id}
                                                                onCardClick={onCardClick}
                                                                editingByCardId={editorsByCardId}
                                                                hoverByCardId={hoverByCardId}
                                                                hoverByListId={hoverByListId}
                                                                remoteDraggingCardIds={remoteDraggingCardIds}
                                                                onCardHover={handleCardHover}
                                                                onListHover={handleListHover}
                                                                onPresenceHoverEnd={handlePresenceHoverEnd}
                                                                index={index}
                                                                onOpenListDetails={setListDetails}
                                                                dragHandleProps={provided.dragHandleProps}
                                                                isDropped={list.id === droppedListId}
                                                                entryDelay={list.isNew ? 0 : Math.round(index * step)}
                                                            />
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}

                                            {/* Add List Placeholder */}
                                            <div
                                                className="board-add-list"
                                                style={{ animationDelay: `${addListDelay}ms` }}
                                            >
                                                {addingList ? (
                                                    <form onSubmit={handleAddList} className="board-add-list-form animate-scale-in">
                                                        <input
                                                            type="text"
                                                            placeholder="Nome da lista..."
                                                            value={newListTitle}
                                                            onChange={e => setNewListTitle(e.target.value)}
                                                            autoFocus
                                                            onBlur={() => { if (!newListTitle.trim()) setAddingList(false); }}
                                                        />
                                                        <div className="board-add-list-actions">
                                                            <button type="submit" className="btn btn-primary btn-sm">Adicionar</button>
                                                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAddingList(false)}>Cancelar</button>
                                                        </div>
                                                    </form>
                                                ) : (
                                                    <button className="board-add-list-btn" onClick={() => setAddingList(true)}>
                                                        <Plus size={18} />
                                                        <span>Adicionar lista</span>
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        )}
                    </Droppable>
                    <CollabPresenceLayer mode="screen" peerFilter={isPeerOnBoardSurface} />
                    <RemoteDragLayer boardId={board.id} />
                </>
            </div>

            {listDetails && (
                <ListDetailsModal
                    list={listDetails}
                    boardId={board.id}
                    onSave={handleSaveListDetails}
                    onClose={() => setListDetails(null)}
                />
            )}

            {showShareModal && (
                <BoardDetailsModal
                    board={board}
                    onClose={() => setShowShareModal(false)}
                    initialTab="share"
                />
            )}
        </div>
    );
}

export default forwardRef(BoardView);
