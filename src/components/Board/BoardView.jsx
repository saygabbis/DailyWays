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
import {
    copyCardsToClipboard,
    cutCardsToClipboard,
    pasteCardsFromClipboard,
    bulkDeleteCards,
    bulkDuplicateCards,
    bulkMoveCardsToIndex,
    resolveSelectedCards,
} from './boardCardBulkOps';
import './Board.css';
import { computeProfileMenuAvoidance } from './boardToolbarProfileAvoid';

function BoardView({ onCardClick, focusedCardId = null, boardAwayOverlay = false }, ref) {
    const { state, getActiveBoard, dispatch, isSavingBoard, showBoardToolbar, profileMenuOpen, showConfirm } = useApp();
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
    const collabHydrating = Boolean(
        isCollabEnabled()
        && board?.id
        && boardCollab
        && !boardCollab.isBoardRoomReady(board.id),
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
    }, [board?.id, collab?.socket, collab?.connected, user?.id, profile]);

    const { hoverByCardId, hoverByListId, hoverByUiKey, remoteDrags, remoteListDrags } = useBoardPresenceHighlights();
    const remoteDraggingCardIds = useMemo(
        () => new Set(remoteDrags.map((d) => d.cardId)),
        [remoteDrags],
    );
    const remoteDraggingListIds = useMemo(
        () => new Set(remoteListDrags.map((d) => d.listId)),
        [remoteListDrags],
    );
    const remoteDragByCardId = useMemo(() => {
        const map = {};
        for (const d of remoteDrags) map[d.cardId] = d;
        return map;
    }, [remoteDrags]);

    /** Peer de arrasto por card (inclui todos os slots da multiseleção remota). */
    const remoteDragPeerByCardId = useMemo(() => {
        const map = {};
        for (const d of remoteDrags) {
            if (d.multiDragCardIds?.length > 1) {
                for (const cardId of d.multiDragCardIds) {
                    map[cardId] = d;
                }
            } else if (d.cardId) {
                map[d.cardId] = d;
            }
        }
        return map;
    }, [remoteDrags]);

    const remoteMultiDragCompanionIds = useMemo(() => {
        const ids = new Set();
        for (const d of remoteDrags) {
            if (!d.multiDragCardIds || d.multiDragCardIds.length < 2) continue;
            for (const cardId of d.multiDragCardIds) {
                if (cardId !== d.cardId) ids.add(cardId);
            }
        }
        return ids;
    }, [remoteDrags]);
    const remoteDragByListId = useMemo(() => {
        const map = {};
        for (const d of remoteListDrags) map[d.listId] = d;
        return map;
    }, [remoteListDrags]);

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
    const [layoutRepaint, setLayoutRepaint] = useState(0);
    const [isPanning, setIsPanning] = useState(false);
    const panningData = useRef({
        isDown: false,
        startX: 0,
        scrollLeft: 0,
        moved: false
    });

    useEffect(() => {
        const el = scrollerRef.current;
        if (!el || !board?.id) return undefined;
        const bump = () => setLayoutRepaint((n) => n + 1);
        el.addEventListener('scroll', bump, { passive: true });
        const ro = new ResizeObserver(bump);
        ro.observe(el);
        window.addEventListener('resize', bump, { passive: true });
        return () => {
            el.removeEventListener('scroll', bump);
            ro.disconnect();
            window.removeEventListener('resize', bump);
        };
    }, [board?.id]);

    // Pan horizontal só com mouse — no touch o scroll nativo do .board-scroller não conflita com o DnD
    const handlePanPointerDown = (e) => {
        if (e.pointerType !== 'mouse') return;
        if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
        if (e.shiftKey) return;
        const target = e.target;
        const isInteractive = target.closest('button, a, input, textarea, .board-card, .board-list-header, .board-list-footer');
        if (isInteractive) return;

        if (!e.shiftKey && !target.closest('.board-card')) {
            clearSelection();
        }

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

        const dragIdsFromStore = useBoardSelectionStore.getState().multiDragCardIds;
        const isMultiDrag = dragIdsFromStore.length > 1;

        if (
            !isMultiDrag
            && source.droppableId === destination.droppableId
            && source.index === destination.index
        ) {
            return;
        }

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
        const dragIds = isMultiDrag ? dragIdsFromStore : [cardId];
        const cardsToMove = resolveSelectedCards(b, dragIds);

        if (cardsToMove.length > 1) {
            bulkMoveCardsToIndex(
                cardsToMove,
                destination.droppableId,
                destination.index,
                cardId,
                getActiveBoard,
                collabDispatch,
                getBoardSnapshot,
            );
            return;
        }

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
            const allSubtasksDone = movedCard.subtasks?.every((st) => st.done);
            if (!movedCard.completed || !allSubtasksDone) {
                collabDispatch({
                    type: 'UPDATE_CARD',
                    payload: {
                        boardId: b.id,
                        listId: destination.droppableId,
                        cardId: movedCard.id,
                        updates: {
                            completed: true,
                            subtasks: (movedCard.subtasks || []).map((st) => ({ ...st, done: true })),
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

    /** Deslocamento temporário (viewport px) — não altera toolbarPos; zera ao fechar o menu. */
    const [profileAvoidTranslate, setProfileAvoidTranslate] = useState({ x: 0, y: 0 });

    useLayoutEffect(() => {
        if (!profileMenuOpen || !showBoardToolbar) {
            setProfileAvoidTranslate({ x: 0, y: 0 });
            return undefined;
        }

        const run = () => {
            const boardEl = containerRef.current;
            const menuEl = document.querySelector('[data-profile-menu-dropdown]')
                || document.querySelector('.header-profile-dropdown');
            const toolEl = toolbarRef.current;
            if (!boardEl || !menuEl || !toolEl) {
                setProfileAvoidTranslate({ x: 0, y: 0 });
                return;
            }
            const boardRect = boardEl.getBoundingClientRect();
            const menuRect = menuEl.getBoundingClientRect();
            if (menuRect.width < 2 || menuRect.height < 2) {
                return;
            }
            /* Medir posição “natural” sem o deslocamento de evitação do frame anterior */
            const prevTransform = toolEl.style.transform;
            toolEl.style.transform = 'none';
            const toolRect = toolEl.getBoundingClientRect();
            toolEl.style.transform = prevTransform;

            setProfileAvoidTranslate(
                computeProfileMenuAvoidance(toolRect, menuRect, boardRect),
            );
        };

        run();
        const raf1 = requestAnimationFrame(() => {
            run();
            requestAnimationFrame(run);
        });
        window.addEventListener('resize', run);

        let ro;
        if (typeof ResizeObserver !== 'undefined') {
            ro = new ResizeObserver(run);
            const menuEl = document.querySelector('[data-profile-menu-dropdown]')
                || document.querySelector('.header-profile-dropdown');
            if (menuEl) ro.observe(menuEl);
            if (toolbarRef.current) ro.observe(toolbarRef.current);
        }

        return () => {
            cancelAnimationFrame(raf1);
            window.removeEventListener('resize', run);
            ro?.disconnect();
        };
    }, [
        profileMenuOpen,
        showBoardToolbar,
        toolbarPos?.x,
        toolbarPos?.y,
        board?.id,
        narrowBoardLayout,
        toolbarMembers.length,
        toolbarMembersLoading,
    ]);

    const toolbarDefaultBottomCorner = narrowBoardLayout && toolbarPos == null;

    const toolbarAvoidTransform = useMemo(() => {
        if (!profileMenuOpen || isDragging) return 'none';
        const { x, y } = profileAvoidTranslate;
        if (!x && !y) return 'none';
        return `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }, [profileMenuOpen, profileAvoidTranslate, isDragging]);

    useEffect(() => {
        const isEditableTarget = () => {
            const el = document.activeElement;
            if (!el) return false;
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable) {
                return true;
            }
            return false;
        };

        const shouldHandleShortcut = () => {
            if (focusedCardId) return false;
            if (isEditableTarget()) return false;
            return Boolean(getActiveBoard()?.id);
        };

        const onKeyDown = async (e) => {
            const activeBoard = getActiveBoard();
            if (!shouldHandleShortcut() || !activeBoard) return;
            const mod = e.ctrlKey || e.metaKey;
            const key = e.key.toLowerCase();

            if (e.key === 'Escape') {
                if (selectedCardIds.length) {
                    e.preventDefault();
                    clearSelection();
                }
                return;
            }

            if (!selectedCardIds.length && !mod) return;

            if (mod && key === 'd' && !e.shiftKey) {
                e.preventDefault();
                const cards = resolveSelectedCards(activeBoard, selectedCardIds);
                if (cards.length) {
                    bulkDuplicateCards(cards, activeBoard.id, collabDispatch);
                }
                return;
            }

            if (mod && key === 'c' && !e.shiftKey) {
                e.preventDefault();
                const cards = resolveSelectedCards(activeBoard, selectedCardIds);
                copyCardsToClipboard(cards, activeBoard.id, anchorListId, setClipboard);
                return;
            }
            if (mod && key === 'x' && !e.shiftKey) {
                e.preventDefault();
                const cards = resolveSelectedCards(activeBoard, selectedCardIds);
                await cutCardsToClipboard(cards, activeBoard.id, anchorListId, setClipboard, collabDispatch, getBoardSnapshot);
                clearSelection();
                return;
            }
            if (mod && key === 'v' && !e.shiftKey) {
                e.preventDefault();
                if (!clipboard?.cards?.length) return;
                const targetListId = anchorListId || activeBoard.lists[0]?.id;
                if (!targetListId) return;
                pasteCardsFromClipboard(clipboard, targetListId, activeBoard.id, collabDispatch);
                if (clipboard.mode === 'cut') {
                    useBoardSelectionStore.getState().clearClipboard();
                }
                return;
            }
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedCardIds.length) {
                e.preventDefault();
                const cards = resolveSelectedCards(activeBoard, selectedCardIds);
                const ok = await bulkDeleteCards(
                    cards,
                    activeBoard.id,
                    collabDispatch,
                    showConfirm,
                    getBoardSnapshot,
                    { defaultPermanentChecked: e.shiftKey },
                );
                if (ok) clearSelection();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [
        getActiveBoard,
        selectedCardIds,
        focusedCardId,
        clipboard,
        anchorListId,
        clearSelection,
        setClipboard,
        collabDispatch,
        showConfirm,
        getBoardSnapshot,
    ]);

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
