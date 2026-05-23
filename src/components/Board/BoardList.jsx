import { useState, useEffect } from 'react';
import { useRemoteListAnim } from '../../hooks/useBoardRemoteAnim';
import ReactDOM from 'react-dom';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { useApp } from '../../context/AppContext';
import { useBoardCollabDispatch } from '../../collab/board/ops/BoardCollabContext.jsx';
import { useContextMenu } from '../Common/ContextMenu';
import { useCoarsePointer } from '../../hooks/useCoarsePointer';
import BoardCard from './BoardCard';
import BoardMultiDragStack from './BoardMultiDragStack';
import ListDetailsModal from './ListDetailsModal';
import { Plus, MoreHorizontal, Trash2, Edit3, SortAsc, Copy, Settings2, CheckCircle } from 'lucide-react';
import { uuidv4 } from '../../utils/uuid';

export default function BoardList({
    list,
    boardId,
    boardLists = [],
    onCardClick,
    index,
    onOpenListDetails,
    dragHandleProps,
    isDropped,
    entryDelay = 0,
    editingByCardId,
    hoverByCardId,
    hoverByListId,
    onCardHover,
    onCardHoverEnd,
    onListHover,
    onPresenceHoverEnd,
    remoteDraggingCardIds,
    remoteDragByCardId = {},
    remoteDragPeerByCardId = {},
    remoteSelectionByCardId = {},
    multiDragCardIds = [],
    multiDragCardPreviews = [],
    remoteMultiDragCompanionIds = null,
    shiftSelecting = false,
}) {
    const { state, showConfirm } = useApp();
    const { collabDispatch } = useBoardCollabDispatch(boardId);
    const { showContextMenu } = useContextMenu();
    const coarsePointer = useCoarsePointer();
    const [addingCard, setAddingCard] = useState(false);
    const [newCardTitle, setNewCardTitle] = useState('');
    const [editing, setEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(list.title);

    const searchQuery = state.searchQuery?.toLowerCase() || '';

    const isFiltering =
        Boolean(searchQuery) ||
        state.filterPriority !== 'all' ||
        state.filterLabel !== 'all';

    const filteredCards = list.cards.filter(card => {
        if (searchQuery && !card.title.toLowerCase().includes(searchQuery) &&
            !card.description?.toLowerCase().includes(searchQuery)) {
            return false;
        }
        if (state.filterPriority !== 'all' && card.priority !== state.filterPriority) return false;
        if (state.filterLabel !== 'all' && !card.labels.includes(state.filterLabel)) return false;
        return true;
    });

    const filteredCardIds = filteredCards.map((c) => c.id);

    const handleAddCard = (e) => {
        e.preventDefault();
        if (!newCardTitle.trim()) return;
        collabDispatch({
            type: 'ADD_CARD',
            payload: {
                boardId,
                listId: list.id,
                title: newCardTitle,
                cardData: { id: uuidv4() },
            },
        });
        setNewCardTitle('');
        setAddingCard(false);
    };

    const handleDeleteList = async () => {
        const confirmed = await showConfirm({
            title: 'Deletar Lista',
            message: `Tem certeza que deseja deletar a lista "${list.title}"? Todas as tarefas dentro dela serão removidas permanentemente.`,
            confirmLabel: 'Deletar',
            type: 'danger'
        });

        if (confirmed) {
            collabDispatch({ type: 'DELETE_LIST', payload: { boardId, listId: list.id } });
        }
        setShowMenu(false);
    };

    const handleRenameList = (e) => {
        e.preventDefault();
        collabDispatch({ type: 'UPDATE_LIST', payload: { boardId, listId: list.id, updates: { title: editTitle } } });
        setEditing(false);
    };

    const handleSaveListDetails = (updates) => {
        collabDispatch({ type: 'UPDATE_LIST', payload: { boardId, listId: list.id, updates } });
        if (updates.title !== undefined) setEditTitle(updates.title);
        setShowListDetails(false);
    };

    // Context menu items for the list
    const getListContextItems = () => [
        {
            label: 'Detalhes da lista',
            icon: <Settings2 size={15} />,
            action: () => onOpenListDetails(list),
        },
        {
            label: 'Renomear lista',
            icon: <Edit3 size={15} />,
            action: () => setEditing(true),
        },
        {
            label: 'Ordernar por prioridade',
            icon: <SortAsc size={15} />,
            action: () => {
                const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
                const sortedCards = [...list.cards].sort(
                    (a, b) => (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4)
                );
                collabDispatch({
                    type: 'UPDATE_LIST',
                    payload: { boardId, listId: list.id, updates: { cards: sortedCards } },
                });
            },
        },
        { type: 'divider' },
        {
            label: 'Deletar lista',
            icon: <Trash2 size={15} />,
            danger: true,
            action: handleDeleteList,
        },
    ];

    const handleListContextMenu = (e) => {
        showContextMenu(e, getListContextItems(), { title: list.title, tint: list.color || null });
    };

    const remoteListAnim = useRemoteListAnim(list.id);

    // Animação de entrada (dispara só na montagem, com stagger por index)
    const [shouldAnimate, setShouldAnimate] = useState(true);
    useEffect(() => {
        const timer = setTimeout(() => {
            setShouldAnimate(false);
        }, 1400); // stagger máx (6 * 110ms = 660ms) + duração (600ms) + margem
        return () => clearTimeout(timer);
    }, []);

    // Animação de drop: re-aciona ao soltar a lista após drag
    useEffect(() => {
        if (!isDropped && !remoteListAnim) return;
        setShouldAnimate(true);
        const timer = setTimeout(() => setShouldAnimate(false), 900);
        return () => clearTimeout(timer);
    }, [isDropped, remoteListAnim]);

    // delay: 0 se solta por drag; usa entryDelay (calculado pelo BoardView) na entrada
    const animDelay = isDropped ? '0ms' : `${entryDelay}ms`;

    const listHoverPeers = hoverByListId?.[list.id] || [];
    const listPresenceColor = listHoverPeers[0]?.color;

    return (
        <div
            className={`board-list ${listHoverPeers.length ? 'board-list-remote-hover' : ''}`}
            onContextMenu={handleListContextMenu}
            onMouseEnter={() => onListHover?.(list.id)}
            onMouseLeave={() => onPresenceHoverEnd?.()}
            style={{
                ...(list.color ? { '--list-accent': list.color } : {}),
                ...(listPresenceColor ? { '--presence-color': listPresenceColor } : {}),
            }}
            data-colored={list.color ? 'true' : undefined}
        >
            <div
                className={`board-list-inner ${shouldAnimate ? 'animate-slide-up-jelly' : ''}`}
                style={{ animationDelay: animDelay }}
            >
                {/* List Header */}
                <div className="board-list-header" {...dragHandleProps}>
                    {editing ? (
                        <form onSubmit={handleRenameList} className="board-list-rename">
                            <input
                                value={editTitle}
                                onChange={e => setEditTitle(e.target.value)}
                                autoFocus
                                onBlur={handleRenameList}
                            />
                        </form>
                    ) : (
                        <h3 className="board-list-title" onClick={() => setEditing(true)} style={{ cursor: 'pointer' }}>
                            {list.isCompletionList && <CheckCircle size={14} className="list-completion-icon" />}
                            {list.title}
                            <span className="board-list-count">{list.cards.length}</span>
                        </h3>
                    )}
                    <div className="board-list-actions">
                        <button
                            className="btn-icon btn-sm"
                            onClick={(e) => { e.stopPropagation(); handleListContextMenu(e); }}
                            title="Opções"
                        >
                            <MoreHorizontal size={16} className="rotate-90" />
                        </button>
                    </div>
                </div>

                {/* Cards */}
                <Droppable droppableId={list.id}>
                    {(provided, snapshot) => (
                        <div
                            className={`board-list-cards ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                        >
                            {filteredCards.map((card, index) => (
                                <Draggable
                                    key={card.id}
                                    draggableId={card.id}
                                    index={index}
                                    isDragDisabled={isFiltering || shiftSelecting}
                                >
                                    {(provided, snapshot) => {
                                        const isMultiDragLead = snapshot.isDragging
                                            && multiDragCardIds.length > 1;
                                        const isMultiDragCompanion = !snapshot.isDragging
                                            && multiDragCardIds.length > 1
                                            && multiDragCardIds.includes(card.id);
                                        const isRemoteMultiDragCompanion = remoteMultiDragCompanionIds?.has(card.id);
                                        const isRemoteMultiDragLead = remoteDragByCardId?.[card.id]?.multiDragCardIds?.length > 1;
                                        const isRemoteSingleDragging = remoteDraggingCardIds?.has(card.id)
                                            && !isRemoteMultiDragLead;
                                        const isRemoteMultiDragSlot = isRemoteMultiDragLead || isRemoteMultiDragCompanion;
                                        const isRemoteDragGap = isRemoteSingleDragging || isRemoteMultiDragSlot;
                                        const remoteDragPeer = remoteDragPeerByCardId?.[card.id]
                                            || remoteDragByCardId?.[card.id];
                                        const stackItems = multiDragCardPreviews.filter((p) => p.id !== card.id);
                                        const cardContent = (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                {...provided.dragHandleProps}
                                                className={[
                                                    'board-card-drag-wrap',
                                                    provided.draggableProps.className,
                                                    snapshot.isDragging && coarsePointer ? 'board-card-drag-touch' : '',
                                                    isMultiDragLead ? 'board-card-drag-wrap--multi-stack' : '',
                                                    isMultiDragCompanion ? 'board-card-drag-wrap--multi-hidden' : '',
                                                ].filter(Boolean).join(' ')}
                                                style={{
                                                    ...provided.draggableProps.style,
                                                    cursor: snapshot.isDragging ? 'grabbing' : 'pointer',
                                                }}
                                            >
                                                {isRemoteDragGap ? (
                                                    <div
                                                        className="board-card-remote-drag-gap"
                                                        style={remoteDragPeer?.color
                                                            ? { '--presence-color': remoteDragPeer.color }
                                                            : undefined}
                                                        aria-hidden
                                                    />
                                                ) : (
                                                    <>
                                                        {isMultiDragLead && (
                                                            <BoardMultiDragStack
                                                                count={multiDragCardIds.length}
                                                                items={stackItems}
                                                            />
                                                        )}
                                                        <BoardCard
                                                            card={card}
                                                            boardId={boardId}
                                                            listId={list.id}
                                                            listColor={list.color}
                                                            boardLists={boardLists}
                                                            visibleCardIds={filteredCardIds}
                                                            isDragging={snapshot.isDragging}
                                                            isMultiDragLead={isMultiDragLead}
                                                            multiDragCount={multiDragCardIds.length}
                                                            remoteDragPeer={remoteDragPeer}
                                                            onClick={() => onCardClick(card, boardId, list.id)}
                                                            editingEditors={editingByCardId?.[card.id] || []}
                                                            hoverPeers={hoverByCardId?.[card.id] || []}
                                                            remoteSelectionPeers={remoteSelectionByCardId?.[card.id] || []}
                                                            onHoverStart={() => onCardHover?.(card.id)}
                                                            onHoverEnd={() => onCardHoverEnd?.(list.id)}
                                                        />
                                                    </>
                                                )}
                                            </div>
                                        );

                                        /* Portal para body quebra a cadeia de touch no iOS/Android; no touch mantém no DOM. */
                                        if (snapshot.isDragging && !coarsePointer) {
                                            return ReactDOM.createPortal(cardContent, document.body);
                                        }
                                        return cardContent;
                                    }}
                                </Draggable>
                            ))}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>

                {/* Add Card */}
                <div className="board-list-footer">
                    {addingCard ? (
                        <form onSubmit={handleAddCard} className="board-add-card-form animate-slide-up-jelly">
                            <input
                                type="text"
                                placeholder="Título da tarefa..."
                                value={newCardTitle}
                                onChange={e => setNewCardTitle(e.target.value)}
                                autoFocus
                                onBlur={() => { if (!newCardTitle.trim()) setAddingCard(false); }}
                            />
                            <div className="board-add-card-actions">
                                <button type="submit" className="btn btn-primary btn-sm">Adicionar</button>
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAddingCard(false)}>✕</button>
                            </div>
                        </form>
                    ) : (
                        <button className="board-add-card-btn" onClick={() => setAddingCard(true)}>
                            <Plus size={16} />
                            <span>Adicionar tarefa</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
