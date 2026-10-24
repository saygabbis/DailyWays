import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef, useMemo } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import BoardList from './BoardList';
import ListDetailsModal from './ListDetailsModal';
import BoardDetailsModal from './BoardDetailsModal';
import { Plus, Loader2, X, GripVertical, Share2 } from 'lucide-react';
import { TEXT } from '@dailyways/limits';
import { fetchBoardMembers } from '../../services/boardSharingService';
import { sortBoardMembersOwnerFirst } from '../../services/boardMappers';
import { useMergedBoardEditors } from '../../hooks/useMergedBoardEditors';
import BoardCollabStatusBanner from '../../collab/board/ui/BoardCollabStatusBanner.jsx';
import CollabPresenceLayer from '../../collab/board/ui/CollabPresenceLayer.jsx';
import { pointerCoordsFromBoardEvent } from '../../collab/board/coords/boardCursorCoords.js';
import { isPeerOnBoardSurface } from '../../collab/board/presence/presenceVisibility.js';
import RemoteDragLayer from '../../collab/board/ui/RemoteDragLayer.jsx';
import PresenceOnlineList from '../../collab/board/ui/PresenceOnlineList.jsx';
import { setLastBoardPointer } from '../../collab/board/presence/lastBoardPointer.js';
import { useCollab } from '../../collab/core/CollabContext.jsx';
import {
    scheduleBoardPresencePublish,
    prepareBoardSurfacePresence,
    restoreBoardPresenceAfterModal,
    publishBoardPresenceFull,
    scheduleBoardCursorResyncAfterModal,
} from '../../collab/board/presence/boardPresencePublish.js';
import { publishBoardPresenceFocus } from '../../collab/board/presence/boardPresenceFocus.js';
import { announcePresence } from '../../collab/board/presence/presenceBridge.js';
import { useBoardPresenceHighlights } from '../../hooks/useBoardPresenceHighlights';
import { BOARD_UI_HOVER, boardUiHoverProps } from '../../collab/board/presence/boardUiHover.js';
import { useBoardCollabDispatch, useBoardCollabContext } from '../../collab/board/ops/BoardCollabContext.jsx';
import { isCollabEnabled } from '../../collab/core/collabConfig.js';
import { useCollabPresence } from '../../collab/board/presence/useCollabPresence.js';
import { uuidv4 } from '../../utils/uuid';
import { useBoardSelectionStore } from '../../stores/boardSelectionStore';
import { useBoardRemoteSelection } from '../../hooks/useBoardRemoteSelection';
import BoardMarqueeSelection from './BoardMarqueeSelection';
import BoardDragEdgeScroll from './BoardDragEdgeScroll';
import { resolveSelectedCards } from './boardCardBulkOps';
import './Board.css';
import { useRemoteDragMaps } from './hooks/useRemoteDragMaps';
import { useBoardPanning } from './hooks/useBoardPanning';
import { useBoardDragEnd } from './hooks/useBoardDragEnd';
import { useBoardToolbarDrag } from './hooks/useBoardToolbarDrag';
import { useBoardKeyboardShortcuts } from './hooks/useBoardKeyboardShortcuts';

const COLLAB_CONNECT_GRACE_MS = 4000;

function BoardView({ onCardClick, focusedCardId = null, boardAwayOverlay = false }, ref) {
    const { state, getActiveBoard, dispatch, showBoardToolbar, profileMenuOpen, showConfirm } = useApp();
    const { user, profile } = useAuth();
    const collab = useCollab();
    const scrollerRef = useRef(null);
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
    const [pointerInBoard, setPointerInBoard] = useState(true);
    const [isDndDragging, setIsDndDragging] = useState(
        () => typeof document !== 'undefined' && document.body.classList.contains('dnd-dragging'),
    );
    const [holdBoardSurface, setHoldBoardSurface] = useState(false);
    const prevFocusedCardIdRef = useRef(focusedCardId);

    useEffect(() => {
        if (typeof document === 'undefined') return undefined;
        const sync = () => {
            setIsDndDragging(document.body.classList.contains('dnd-dragging'));
        };
        const mo = new MutationObserver(sync);
        mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        return () => mo.disconnect();
    }, []);

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
    const boardCollab = useBoardCollabContext();
    const { collabDispatch, connected: collabConnected } = useBoardCollabDispatch(board?.id);
    const getBoardSnapshot = useCallback((boardId) => {
        const b = state.boards.find((x) => x.id === boardId);
        return b ? JSON.parse(JSON.stringify(b)) : null;
    }, [state.boards]);
    // Sem socket por alguns segundos (collab fora do ar) → mostra o board em modo fallback
    // (save pelo navegador) em vez de ficar preso em "Sincronizando…" para sempre.
    const [collabConnectGraceOver, setCollabConnectGraceOver] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setCollabConnectGraceOver(true), COLLAB_CONNECT_GRACE_MS);
        return () => clearTimeout(t);
    }, []);
    const collabHydrating = Boolean(
        isCollabEnabled()
        && board?.id
        && boardCollab
        && !boardCollab.isBoardRoomReady(board.id)
        && (boardCollab.connected || !collabConnectGraceOver),
    );
    const {
        updateCursor: updateBoardCursor,
        updateCardSelection,
        setHoverTarget,
        clearHoverTarget,
    } = useCollabPresence(board?.id, { mode: 'screen' });

    const selectedCardIds = useBoardSelectionStore((s) => s.selectedCardIds);
    const shiftSelecting = useBoardSelectionStore((s) => s.shiftSelecting);
    const setBoardSelection = useBoardSelectionStore((s) => s.setBoard);
    const clearSelection = useBoardSelectionStore((s) => s.clearSelection);
    const clipboard = useBoardSelectionStore((s) => s.clipboard);
    const setClipboard = useBoardSelectionStore((s) => s.setClipboard);
    const anchorListId = useBoardSelectionStore((s) => s.anchorListId);
    const multiDragCardIds = useBoardSelectionStore((s) => s.multiDragCardIds);
    const { remoteSelectionByCardId } = useBoardRemoteSelection();

    const multiDragCardPreviews = useMemo(() => {
        if (!board || multiDragCardIds.length < 2) return [];
        return resolveSelectedCards(board, multiDragCardIds).map(({ card }) => ({
            id: card.id,
            title: card.title,
        }));
    }, [board, multiDragCardIds]);

    useEffect(() => {
        if (board?.id) setBoardSelection(board.id);
    }, [board?.id, setBoardSelection]);

    useEffect(() => {
        if (!board?.id) return;
        updateCardSelection(selectedCardIds);
    }, [board?.id, selectedCardIds, updateCardSelection]);

    const onBoardSurface = Boolean(
        board?.id
        && !boardAwayOverlay
        && !listDetails
        && !showShareModal
        && (pointerInBoard || isDndDragging || holdBoardSurface),
    );

    useEffect(() => {
        if (!board?.id) return undefined;
        const hadModal = prevFocusedCardIdRef.current;
        const closedModal = hadModal && !focusedCardId;
        prevFocusedCardIdRef.current = focusedCardId;
        if (!closedModal) return undefined;
        setHoldBoardSurface(true);
        restoreBoardPresenceAfterModal(board.id);
        announcePresence(board.id);
        let cancelResync = () => {};
        if (collab?.socket?.connected) {
            const auth = { user, profile };
            publishBoardPresenceFull(collab.socket, board.id, auth);
            cancelResync = scheduleBoardCursorResyncAfterModal(board.id, () => {
                if (!collab?.socket?.connected) return;
                publishBoardPresenceFull(collab.socket, board.id, auth);
                announcePresence(board.id);
            });
        }
        const t = setTimeout(() => setHoldBoardSurface(false), 600);
        return () => {
            clearTimeout(t);
            cancelResync();
        };
    }, [focusedCardId, board?.id, collab?.socket, collab?.connected, user, profile]);

    useEffect(() => {
        if (!board?.id) return undefined;
        publishBoardPresenceFocus(board.id, onBoardSurface);
        return undefined;
    }, [board?.id, onBoardSurface]);

    useEffect(() => {
        if (!board?.id) return undefined;
        const onPointerMove = (e) => {
            const el = scrollerRef.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            const inside = e.clientX >= r.left && e.clientX <= r.right
                && e.clientY >= r.top && e.clientY <= r.bottom;
            setPointerInBoard((prev) => (prev === inside ? prev : inside));
        };
        document.addEventListener('pointermove', onPointerMove, { passive: true });
        return () => document.removeEventListener('pointermove', onPointerMove);
    }, [board?.id]);

    useEffect(() => {
        if (!board?.id || !collab?.socket?.connected) return undefined;
        prepareBoardSurfacePresence(board.id);
        const auth = { user, profile };
        const publish = () => scheduleBoardPresencePublish(collab.socket, board.id, auth);
        publish();
        const raf = requestAnimationFrame(publish);
        announcePresence(board.id);
        return () => cancelAnimationFrame(raf);
    }, [board?.id, collab?.socket, collab?.connected, user, profile]);

    const { hoverByCardId, hoverByListId, hoverByUiKey, remoteDrags, remoteListDrags } = useBoardPresenceHighlights();
    const {
        remoteDraggingCardIds,
        remoteDraggingListIds,
        remoteDragByCardId,
        remoteDragPeerByCardId,
        remoteMultiDragCompanionIds,
        remoteDragByListId,
    } = useRemoteDragMaps({
        remoteDrags,
        remoteListDrags,
    });

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


    const {
        layoutRepaint,
        isPanning,
        handlePanPointerDown,
        handleContextMenu,
    } = useBoardPanning({
        scrollerRef,
        board,
        clearSelection,
    });

    const {
        handleDragEnd,
    } = useBoardDragEnd({
        state,
        getActiveBoard,
        setDroppedListId,
        collabDispatch,
        getBoardSnapshot,
    });

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

    const {
        handleToolbarPointerDown,
        toolbarDefaultBottomCorner,
        toolbarAvoidTransform,
    } = useBoardToolbarDrag({
        showBoardToolbar,
        profileMenuOpen,
        toolbarMembers,
        toolbarMembersLoading,
        narrowBoardLayout,
        toolbarPos,
        setToolbarPos,
        isDragging,
        setIsDragging,
        dragStartRef,
        toolbarRef,
        containerRef,
        board,
    });

    useBoardKeyboardShortcuts({
        focusedCardId,
        getActiveBoard,
        showConfirm,
        collabDispatch,
        getBoardSnapshot,
        selectedCardIds,
        clearSelection,
        clipboard,
        setClipboard,
        anchorListId,
    });

    const handleBoardPointerMove = useCallback((e) => {
        if (!onBoardSurface) return;
        const el = scrollerRef.current;
        if (!el) return;
        const coords = pointerCoordsFromBoardEvent(e, el);
        if (board?.id) {
            setLastBoardPointer(board.id, {
                x: coords.x,
                y: coords.y,
                cursorScreen: coords.cursorScreen,
            });
        }
        updateBoardCursor({
            ...coords,
            selectedCardId: null,
        });
    }, [updateBoardCursor, board?.id, onBoardSurface]);

    const handleCardHover = useCallback((cardId) => {
        if (!onBoardSurface) return;
        setHoverTarget({ cardId, listId: null, uiKey: null });
    }, [setHoverTarget, onBoardSurface]);

    const handleCardHoverEnd = useCallback((listId) => {
        if (!onBoardSurface) return;
        setHoverTarget({ listId: listId ?? null, cardId: null, uiKey: null });
    }, [setHoverTarget, onBoardSurface]);

    const handleListHover = useCallback((listId) => {
        if (!onBoardSurface) return;
        setHoverTarget({ listId, cardId: null, uiKey: null });
    }, [setHoverTarget, onBoardSurface]);

    const handleUiHover = useCallback((uiKey) => {
        if (!onBoardSurface || !uiKey) return;
        setHoverTarget({ uiKey, cardId: null, listId: null });
    }, [setHoverTarget, onBoardSurface]);

    const handlePresenceHoverEnd = useCallback(() => {
        clearHoverTarget();
    }, [clearHoverTarget]);

    if (!board) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <h2>Nenhum board selecionado</h2>
                <p>Selecione ou crie um board na sidebar para começar</p>
            </div>
        );
    }

    const addListBtnHover = boardUiHoverProps(hoverByUiKey, BOARD_UI_HOVER.addList, 'board-add-list-btn');

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
                        top: toolbarPos != null ? toolbarPos.y : undefined,
                        right: toolbarPos != null ? 'auto' : undefined,
                        bottom: toolbarPos != null ? 'auto' : undefined,
                        position: 'absolute',
                        transform: toolbarAvoidTransform,
                        transition: isDragging
                            ? 'none'
                            : 'opacity 0.2s ease, transform 0.32s cubic-bezier(0.34, 1.2, 0.64, 1)',
                        touchAction: isDragging ? 'none' : undefined,
                    }}
                    onPointerDown={handleToolbarPointerDown}
                >
                    <div className="board-toolbar-handle">
                        <GripVertical size={14} />
                    </div>
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

            <BoardMarqueeSelection scrollerRef={scrollerRef} />
            <BoardDragEdgeScroll scrollerRef={scrollerRef} />

            <div
                className={`board-scroller ${isPanning ? 'is-panning' : ''} ${collabHydrating ? 'board-scroller--hydrating' : ''}`}
                ref={scrollerRef}
                onPointerMove={handleBoardPointerMove}
                onPointerDown={handlePanPointerDown}
                onContextMenu={handleContextMenu}
            >
                {collabHydrating && (
                    <div className="board-collab-hydrate-overlay" role="status" aria-live="polite">
                        <Loader2 size={28} className="spin" />
                        <span>Sincronizando board…</span>
                    </div>
                )}
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
                                            {board.lists.map((list, index) => {
                                                const isRemoteListDragging = remoteDraggingListIds.has(list.id);
                                                const remoteListDragPeer = remoteDragByListId[list.id];
                                                return (
                                                <Draggable key={list.id} draggableId={list.id} index={index}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            className={[
                                                                'board-list-wrapper',
                                                                snapshot.isDragging ? 'list-dragging' : '',
                                                                isRemoteListDragging ? 'board-list-remote-drag-source' : '',
                                                            ].filter(Boolean).join(' ')}
                                                            style={{
                                                                ...provided.draggableProps.style,
                                                                ...(isRemoteListDragging && remoteListDragPeer?.color
                                                                    ? { '--presence-color': remoteListDragPeer.color }
                                                                    : {}),
                                                            }}
                                                        >
                                                            <BoardList
                                                                list={list}
                                                                boardId={board.id}
                                                                boardLists={board.lists}
                                                                onCardClick={onCardClick}
                                                                editingByCardId={editorsByCardId}
                                                                hoverByCardId={hoverByCardId}
                                                                hoverByListId={hoverByListId}
                                                                hoverByUiKey={hoverByUiKey}
                                                                onUiHover={handleUiHover}
                                                                remoteDraggingCardIds={remoteDraggingCardIds}
                                                                remoteDragByCardId={remoteDragByCardId}
                                                                remoteDragPeerByCardId={remoteDragPeerByCardId}
                                                                remoteSelectionByCardId={remoteSelectionByCardId}
                                                                multiDragCardIds={multiDragCardIds}
                                                                multiDragCardPreviews={multiDragCardPreviews}
                                                                remoteMultiDragCompanionIds={remoteMultiDragCompanionIds}
                                                                shiftSelecting={shiftSelecting}
                                                                onCardHover={handleCardHover}
                                                                onCardHoverEnd={handleCardHoverEnd}
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
                                                );
                                            })}
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
                                                            maxLength={TEXT.listTitle}
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
                                                    <button
                                                        type="button"
                                                        className={addListBtnHover.className}
                                                        style={addListBtnHover.style}
                                                        onMouseEnter={() => handleUiHover(BOARD_UI_HOVER.addList)}
                                                        onMouseLeave={handlePresenceHoverEnd}
                                                        onClick={() => setAddingList(true)}
                                                    >
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
                    {!focusedCardId && !listDetails && (
                        <CollabPresenceLayer
                            mode="screen"
                            peerFilter={isPeerOnBoardSurface}
                            boardScrollerRef={scrollerRef}
                            layoutRepaint={layoutRepaint}
                            boardId={board.id}
                        />
                    )}
                    <RemoteDragLayer boardId={board.id} boardScrollerRef={scrollerRef} layoutRepaint={layoutRepaint} />
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
