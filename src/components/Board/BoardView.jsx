import { useState, useRef, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useApp } from '../../context/AppContext';
import BoardList from './BoardList';
import ShareModal from './ShareModal';
import ListDetailsModal from './ListDetailsModal';
import { Plus, UserPlus, Loader2, X, GripVertical } from 'lucide-react';
import './Board.css';

export default function BoardView({ onCardClick }) {
    const { state, getActiveBoard, dispatch, persistBoard, isSavingBoard, showBoardToolbar } = useApp();
    const [addingList, setAddingList] = useState(false);
    const [newListTitle, setNewListTitle] = useState('');
    const [showShare, setShowShare] = useState(false);
    const [listDetails, setListDetails] = useState(null);
    const [droppedListId, setDroppedListId] = useState(null);

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

    const board = getActiveBoard();




    // ── Panning Logic ──
    const scrollerRef = useRef(null);
    const [isPanning, setIsPanning] = useState(false);
    const panningData = useRef({
        isDown: false,
        startX: 0,
        scrollLeft: 0,
        moved: false
    });

    const handleMouseDown = (e) => {
        // Allow Left (0), Middle (1), and Right (2) buttons
        // Ignore if clicking on interactive elements (buttons, inputs, cards, lists)
        // We want to drag when clicking on the "background" or "scroller"
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
        // Prevent default text selection
        if (e.button === 1) e.preventDefault();
    };

    const handleMouseMove = (e) => {
        if (!panningData.current.isDown) return;

        e.preventDefault();
        const walk = (e.pageX - panningData.current.startX) * 1; // 1:1 scroll speed
        scrollerRef.current.scrollLeft = panningData.current.scrollLeft - walk;

        if (Math.abs(walk) > 5) {
            panningData.current.moved = true;
        }
    };

    const handleMouseUp = (e) => {
        panningData.current.isDown = false;
        setIsPanning(false);
    };

    const handleMouseLeave = () => {
        panningData.current.isDown = false;
        setIsPanning(false);
    };

    const handleContextMenu = (e) => {
        // Prevent context menu if we just panned with right click
        if (panningData.current.moved) {
            e.preventDefault();
            panningData.current.moved = false; // Reset
        }
    };

    const handleDragEnd = (result) => {
        const { source, destination, type } = result;
        if (!destination) return;
        if (source.droppableId === destination.droppableId && source.index === destination.index) return;

        // Handle List Reordering
        if (type === 'list') {
            const movedListId = board.lists[source.index]?.id;
            dispatch({
                type: 'MOVE_LIST',
                payload: {
                    boardId: board.id,
                    sourceIndex: source.index,
                    destIndex: destination.index,
                    userId: state.user?.id
                }
            });
            persistBoard(board.id);
            // Anima a lista que foi solta
            if (movedListId) {
                setDroppedListId(movedListId);
                setTimeout(() => setDroppedListId(null), 900);
            }
            return;
        }

        // Handle Card Movement
        const sourceList = board.lists.find(l => l.id === source.droppableId);
        const destList = board.lists.find(l => l.id === destination.droppableId);
        const movedCard = sourceList?.cards[source.index];

        dispatch({
            type: 'MOVE_CARD',
            payload: {
                boardId: board.id,
                sourceListId: source.droppableId,
                destListId: destination.droppableId,
                sourceIndex: source.index,
                destIndex: destination.index,
            },
        });

        if (destList?.isCompletionList && movedCard?.subtasks?.length > 0) {
            const allDone = movedCard.subtasks.every(st => st.done);
            if (!allDone) {
                dispatch({
                    type: 'UPDATE_CARD',
                    payload: {
                        boardId: board.id,
                        listId: destination.droppableId,
                        cardId: movedCard.id,
                        updates: {
                            subtasks: movedCard.subtasks.map(st => ({ ...st, done: true })),
                        },
                    },
                });
            }
        }

        // Persistir mudança estrutural imediatamente
        persistBoard(board.id);
    };

    const handleSaveListDetails = (updates) => {
        if (!listDetails) return;
        dispatch({ type: 'UPDATE_LIST', payload: { boardId: board.id, listId: listDetails.id, updates } });
        persistBoard(board.id);
        setListDetails(null);
    };

    const handleAddList = async (e) => {
        e.preventDefault();
        if (!newListTitle.trim()) return;
        dispatch({ type: 'ADD_LIST', payload: { boardId: board.id, title: newListTitle } });
        setNewListTitle('');
        setAddingList(false);

        // Persistir mudança estrutural imediatamente
        persistBoard(board.id);
    };

    // Draggable Logic
    const handleToolbarMouseDown = (e) => {
        // Avoid dragging if clicking on a button or other interactive element
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('a')) return;

        // If it's the first drag, get the current position from the DOM
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
    };

    const handleMouseUpGlobal = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isDragging) {
                const deltaX = e.clientX - dragStartRef.current.x;
                const deltaY = e.clientY - dragStartRef.current.y;

                let newX = dragStartRef.current.posX + deltaX;
                let newY = dragStartRef.current.posY + deltaY;

                // Bounds checking
                const width = toolbarRef.current?.offsetWidth || 300;
                const height = toolbarRef.current?.offsetHeight || 50;
                const containerWidth = containerRef.current?.offsetWidth || window.innerWidth;
                const containerHeight = containerRef.current?.offsetHeight || window.innerHeight;
                const padding = 10;

                newX = Math.max(padding, Math.min(newX, containerWidth - width - padding));
                newY = Math.max(padding, Math.min(newY, containerHeight - height - padding));

                const newPos = { x: newX, y: newY };
                setToolbarPos(newPos);
            }
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUpGlobal);
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUpGlobal);
        };
    }, [isDragging, handleMouseUpGlobal]);

    if (!board) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <h2>Nenhum board selecionado</h2>
                <p>Selecione ou crie um board na sidebar para começar</p>
            </div>
        );
    }

    return (
        <div className="board-view" ref={containerRef}>
            {/* Board Toolbar - Floating & Draggable */}
            {showBoardToolbar && (
                <div
                    ref={toolbarRef}
                    className={`board-toolbar floating animate-slide-down ${isDragging ? 'dragging' : ''}`}
                    style={{
                        left: toolbarPos ? toolbarPos.x : undefined,
                        top: toolbarPos ? toolbarPos.y : undefined,
                        right: toolbarPos ? 'auto' : undefined,
                        bottom: toolbarPos ? 'auto' : undefined,
                        position: 'absolute',
                        transition: isDragging ? 'none' : 'opacity 0.2s ease, transform 0.2s ease'
                    }}
                    onMouseDown={handleToolbarMouseDown}
                >
                    <div className="board-toolbar-handle">
                        <GripVertical size={14} />
                    </div>
                    <div className="board-members">
                        <div className="board-avatar" title="Você">Me</div>
                        <div className="board-avatar" title="Alice Silva">AS</div>
                        <div className="board-avatar-more" title="+2 outros">+2</div>
                    </div>
                    <div className="board-toolbar-delim"></div>
                    {isSavingBoard(board.id) && (
                        <span className="board-saving-indicator">
                            <Loader2 size={13} className="spinning" />
                            Salvando...
                        </span>
                    )}
                    <button className="btn btn-primary btn-sm" onClick={() => setShowShare(true)}>
                        <UserPlus size={16} />
                        <span>Compartilhar</span>
                    </button>
                    <button
                        className="btn-icon-xs toolbar-close-btn"
                        onClick={() => dispatch({ type: 'TOGGLE_BOARD_TOOLBAR', payload: false })}
                        title="Fechar toolbar"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            <div
                className={`board-scroller ${isPanning ? 'is-panning' : ''}`}
                ref={scrollerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onContextMenu={handleContextMenu}
            >
                <DragDropContext onDragEnd={handleDragEnd}>
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
                </DragDropContext>
            </div>

            {showShare && <ShareModal boardTitle={board.title} onClose={() => setShowShare(false)} />}

            {listDetails && (
                <ListDetailsModal
                    list={listDetails}
                    boardId={board.id}
                    onSave={handleSaveListDetails}
                    onClose={() => setListDetails(null)}
                />
            )}
        </div>
    );
}
