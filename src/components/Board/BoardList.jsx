import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { useApp } from '../../context/AppContext';
import { useContextMenu, useLongPress } from '../Common/ContextMenu';
import BoardCard from './BoardCard';
import ListDetailsModal from './ListDetailsModal';
import { Plus, MoreHorizontal, Trash2, Edit3, SortAsc, Copy, Settings2, CheckCircle } from 'lucide-react';

export default function BoardList({ list, boardId, onCardClick, index, onOpenListDetails, dragHandleProps, isDropped, entryDelay = 0 }) {
    const { dispatch, state, persistBoard, showConfirm } = useApp();
    const { showContextMenu } = useContextMenu();
    const [addingCard, setAddingCard] = useState(false);
    const [newCardTitle, setNewCardTitle] = useState('');
    const [showMenu, setShowMenu] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(list.title);

    const searchQuery = state.searchQuery?.toLowerCase() || '';

    const filteredCards = list.cards.filter(card => {
        if (searchQuery && !card.title.toLowerCase().includes(searchQuery) &&
            !card.description?.toLowerCase().includes(searchQuery)) {
            return false;
        }
        if (state.filterPriority !== 'all' && card.priority !== state.filterPriority) return false;
        if (state.filterLabel !== 'all' && !card.labels.includes(state.filterLabel)) return false;
        return true;
    });

    const handleAddCard = (e) => {
        e.preventDefault();
        if (!newCardTitle.trim()) return;
        dispatch({
            type: 'ADD_CARD',
            payload: { boardId, listId: list.id, title: newCardTitle },
        });
        persistBoard(boardId);
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
            dispatch({ type: 'DELETE_LIST', payload: { boardId, listId: list.id } });
            persistBoard(boardId);
        }
        setShowMenu(false);
    };

    const handleRenameList = (e) => {
        e.preventDefault();
        dispatch({ type: 'UPDATE_LIST', payload: { boardId, listId: list.id, updates: { title: editTitle } } });
        persistBoard(boardId);
        setEditing(false);
    };

    const handleSaveListDetails = (updates) => {
        dispatch({ type: 'UPDATE_LIST', payload: { boardId, listId: list.id, updates } });
        persistBoard(boardId);
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
                dispatch({
                    type: 'UPDATE_LIST',
                    payload: { boardId, listId: list.id, updates: { cards: sortedCards } },
                });
                persistBoard(boardId);
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
        showContextMenu(e, getListContextItems(), { title: list.title });
    };

    const longPressProps = useLongPress(handleListContextMenu);

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
        if (!isDropped) return;
        setShouldAnimate(true);
        const timer = setTimeout(() => setShouldAnimate(false), 900);
        return () => clearTimeout(timer);
    }, [isDropped]);

    // delay: 0 se solta por drag; usa entryDelay (calculado pelo BoardView) na entrada
    const animDelay = isDropped ? '0ms' : `${entryDelay}ms`;

    return (
        <div
            className="board-list"
            onContextMenu={handleListContextMenu}
            {...longPressProps}
            style={{
                ...list.color ? { borderLeftColor: list.color, borderLeftWidth: 4, borderLeftStyle: 'solid' } : {}
            }}
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
                        <button className="btn-icon btn-sm" onClick={() => setShowMenu(!showMenu)}>
                            <MoreHorizontal size={16} />
                        </button>
                        {showMenu && (
                            <div className="board-list-menu animate-pop-in">
                                <button onClick={() => { setEditing(true); setShowMenu(false); }}>
                                    <Edit3 size={14} /> Renomear
                                </button>
                                <button onClick={handleDeleteList} className="danger">
                                    <Trash2 size={14} /> Deletar lista
                                </button>
                            </div>
                        )}
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
                                <Draggable key={card.id} draggableId={card.id} index={index}>
                                    {(provided, snapshot) => {
                                        const cardContent = (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                {...provided.dragHandleProps}
                                                style={{
                                                    ...provided.draggableProps.style,
                                                    cursor: snapshot.isDragging ? 'grabbing' : 'pointer',
                                                }}
                                            >
                                                <BoardCard
                                                    card={card}
                                                    boardId={boardId}
                                                    listId={list.id}
                                                    isDragging={snapshot.isDragging}
                                                    onClick={() => onCardClick(card, boardId, list.id)}
                                                />
                                            </div>
                                        );

                                        if (snapshot.isDragging) {
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
