import { useState, useEffect } from 'react';
import { TEXT } from '@dailyways/limits';
import { useRemoteListAnim } from '../../hooks/useBoardRemoteAnim';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { dndKind } from '../../dnd/dndRegistry.js';
import { useApp } from '../../context/useApp';
import { useBoardCollabDispatch } from '../../collab/board/ops/useBoardCollab';
import { useContextMenu } from '../Common/useContextMenu';
import BoardCard from './BoardCard';
import { Plus, MoreHorizontal, Trash2, Edit3, SortAsc, Settings2, CheckCircle, CheckSquare } from 'lucide-react';
import { useBoardSelectionStore } from '../../stores/boardSelectionStore';
import { uuidv4 } from '../../utils/uuid';
import { BOARD_UI_HOVER, boardUiHoverProps } from '../../collab/board/presence/boardUiHover.js';

/** Card arrastável (dnd-kit). O original fica como "buraco" translúcido enquanto a prévia voa. */
function SortableCard({ card, listId, boardId, disabled, hidden, children }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: card.id,
        data: { kind: 'card', cardId: card.id, listId, boardId, title: card.title },
        disabled,
    });
    if (hidden) return null;
    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Translate.toString(transform), transition }}
            className={`board-card-drag-wrap dw-sortable ${isDragging ? 'dw-drag-source' : ''}`}
            {...attributes}
            {...listeners}
            aria-roledescription="tarefa arrastável"
        >
            {children(isDragging)}
        </div>
    );
}

export default function BoardList({
    list,
    boardId,
    boardLists = [],
    onCardClick,
    onOpenListDetails,
    listDrag,
    isDropped,
    entryDelay = 0,
    editingByCardId,
    hoverByCardId,
    hoverByListId,
    hoverByUiKey,
    onCardHover,
    onCardHoverEnd,
    onListHover,
    onUiHover,
    onPresenceHoverEnd,
    remoteDraggingCardIds,
    remoteDragByCardId = {},
    remoteDragPeerByCardId = {},
    remoteSelectionByCardId = {},
    multiDragCardIds = [],
    remoteMultiDragCompanionIds = null,
    shiftSelecting = false,
}) {
    const { state, showConfirm } = useApp();
    const isListSelected = useBoardSelectionStore((st) => st.selectedListIds.includes(list.id));
    const toggleList = useBoardSelectionStore((st) => st.toggleList);
    const { collabDispatch } = useBoardCollabDispatch(boardId);
    const { showContextMenu } = useContextMenu();
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
    const { setNodeRef: bindZone, isOver: zoneOver, active: zoneActive } = useDroppable({
        id: `list-zone:${list.id}`,
        data: { kind: 'list-zone', listId: list.id },
    });
    const cardOverZone = zoneOver && dndKind(zoneActive) === 'card';

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
    };

    const handleRenameList = (e) => {
        e.preventDefault();
        collabDispatch({ type: 'UPDATE_LIST', payload: { boardId, listId: list.id, updates: { title: editTitle } } });
        setEditing(false);
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
            label: isListSelected ? 'Tirar da seleção' : 'Selecionar coluna',
            icon: <CheckSquare size={15} />,
            shortcut: 'Ctrl+clique',
            action: () => toggleList(list.id),
        },
        {
            label: 'Ordenar por prioridade',
            icon: <SortAsc size={15} />,
            action: () => {
                const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
                const sortedCards = [...list.cards].sort(
                    (a, b) => (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4)
                );
                collabDispatch({
                    type: 'REORDER_LIST_CARDS',
                    payload: { boardId, listId: list.id, cardIds: sortedCards.map((c) => c.id) },
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
    const [prevDropAnim, setPrevDropAnim] = useState({ isDropped, remoteListAnim });
    if (prevDropAnim.isDropped !== isDropped || prevDropAnim.remoteListAnim !== remoteListAnim) {
        setPrevDropAnim({ isDropped, remoteListAnim });
        if (isDropped || remoteListAnim) setShouldAnimate(true);
    }
    useEffect(() => {
        if (!isDropped && !remoteListAnim) return;
        const timer = setTimeout(() => setShouldAnimate(false), 900);
        return () => clearTimeout(timer);
    }, [isDropped, remoteListAnim]);

    // delay: 0 se solta por drag; usa entryDelay (calculado pelo BoardView) na entrada
    const animDelay = isDropped ? '0ms' : `${entryDelay}ms`;

    const listHoverPeers = hoverByListId?.[list.id] || [];
    const listPresenceColor = listHoverPeers[0]?.color;
    const addCardHoverKey = BOARD_UI_HOVER.addCard(list.id);
    const addCardHover = boardUiHoverProps(hoverByUiKey, addCardHoverKey, 'board-add-card-btn');

    return (
        <div
            className={`board-list ${listHoverPeers.length ? 'board-list-remote-hover' : ''} ${isListSelected ? 'is-selected' : ''}`}
            aria-selected={isListSelected || undefined}
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
                <div
                    className="board-list-header"
                    ref={listDrag?.setActivatorNodeRef}
                    {...(listDrag?.attributes || {})}
                    {...(listDrag?.listeners || {})}
                    aria-roledescription="lista arrastável"
                >
                    {editing ? (
                        <form onSubmit={handleRenameList} className="board-list-rename">
                            <input
                                value={editTitle}
                                maxLength={TEXT.listTitle}
                                onChange={e => setEditTitle(e.target.value)}
                                autoFocus
                                onBlur={handleRenameList}
                            />
                        </form>
                    ) : (
                        <h3
                            className="board-list-title"
                            onClick={(e) => {
                                // Ctrl/Cmd+clique seleciona a coluna; clique simples renomeia
                                if (e.ctrlKey || e.metaKey) {
                                    e.stopPropagation();
                                    toggleList(list.id);
                                    return;
                                }
                                setEditing(true);
                            }}
                            style={{ cursor: 'pointer' }}
                        >
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
                <SortableContext items={filteredCardIds} strategy={verticalListSortingStrategy}>
                    <div
                        className={`board-list-cards ${cardOverZone ? 'dragging-over' : ''}`}
                        ref={bindZone}
                    >
                        {filteredCards.map((card) => {
                            const isMultiDragCompanion = multiDragCardIds.length > 1
                                && multiDragCardIds.includes(card.id)
                                && multiDragCardIds[0] !== card.id;
                            const isRemoteMultiDragCompanion = remoteMultiDragCompanionIds?.has(card.id);
                            const isRemoteMultiDragLead = remoteDragByCardId?.[card.id]?.multiDragCardIds?.length > 1;
                            const isRemoteSingleDragging = remoteDraggingCardIds?.has(card.id) && !isRemoteMultiDragLead;
                            const isRemoteDragGap = isRemoteSingleDragging || isRemoteMultiDragLead || isRemoteMultiDragCompanion;
                            const remoteDragPeer = remoteDragPeerByCardId?.[card.id] || remoteDragByCardId?.[card.id];
                            return (
                                <SortableCard
                                    key={card.id}
                                    card={card}
                                    listId={list.id}
                                    boardId={boardId}
                                    disabled={isFiltering || shiftSelecting}
                                    hidden={isMultiDragCompanion}
                                >
                                    {(isDragging) => (isRemoteDragGap ? (
                                        <div
                                            className="board-card-remote-drag-gap"
                                            style={remoteDragPeer?.color ? { '--presence-color': remoteDragPeer.color } : undefined}
                                            aria-hidden
                                        />
                                    ) : (
                                        <BoardCard
                                            card={card}
                                            boardId={boardId}
                                            listId={list.id}
                                            listColor={list.color}
                                            boardLists={boardLists}
                                            visibleCardIds={filteredCardIds}
                                            isDragging={isDragging}
                                            remoteDragPeer={remoteDragPeer}
                                            onClick={() => onCardClick(card, boardId, list.id)}
                                            editingEditors={editingByCardId?.[card.id] || []}
                                            hoverPeers={hoverByCardId?.[card.id] || []}
                                            remoteSelectionPeers={remoteSelectionByCardId?.[card.id] || []}
                                            onHoverStart={() => onCardHover?.(card.id)}
                                            onHoverEnd={() => onCardHoverEnd?.(list.id)}
                                        />
                                    ))}
                                </SortableCard>
                            );
                        })}
                        {filteredCards.length === 0 && (
                            <div className="board-list-empty" aria-hidden>Solte tarefas aqui</div>
                        )}
                    </div>
                </SortableContext>

                {/* Add Card */}
                <div className="board-list-footer">
                    {addingCard ? (
                        <form onSubmit={handleAddCard} className="board-add-card-form animate-slide-up-jelly">
                            <input
                                type="text"
                                placeholder="Título da tarefa..."
                                value={newCardTitle}
                                maxLength={TEXT.cardTitle}
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
                        <button
                            type="button"
                            className={addCardHover.className}
                            style={addCardHover.style}
                            onMouseEnter={() => onUiHover?.(addCardHoverKey)}
                            onMouseLeave={() => onListHover?.(list.id)}
                            onClick={() => setAddingCard(true)}
                        >
                            <Plus size={16} />
                            <span>Adicionar tarefa</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
