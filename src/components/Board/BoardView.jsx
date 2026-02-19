import { useState } from 'react';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { useApp } from '../../context/AppContext';
import BoardList from './BoardList';
import ShareModal from './ShareModal';
import { Plus, UserPlus, Users } from 'lucide-react';
import './Board.css';

export default function BoardView({ onCardClick }) {
    const { getActiveBoard, dispatch } = useApp();
    const [addingList, setAddingList] = useState(false);
    const [newListTitle, setNewListTitle] = useState('');
    const [showShare, setShowShare] = useState(false);

    const board = getActiveBoard();

    if (!board) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <h2>Nenhum board selecionado</h2>
                <p>Selecione ou crie um board na sidebar para começar</p>
            </div>
        );
    }

    const handleDragEnd = (result) => {
        const { source, destination } = result;
        if (!destination) return;
        if (source.droppableId === destination.droppableId && source.index === destination.index) return;

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
    };

    const handleAddList = (e) => {
        e.preventDefault();
        if (!newListTitle.trim()) return;
        dispatch({ type: 'ADD_LIST', payload: { boardId: board.id, title: newListTitle } });
        setNewListTitle('');
        setAddingList(false);
    };

    return (
        <div className="board-view">
            {/* Board Toolbar */}
            <div className="board-toolbar animate-slide-down">
                <div className="board-members">
                    <div className="board-avatar" title="Você">Me</div>
                    <div className="board-avatar" title="Alice Silva">AS</div>
                    <div className="board-avatar-more" title="+2 outros">+2</div>
                </div>
                <div className="board-toolbar-delim"></div>
                <button className="btn btn-primary btn-sm" onClick={() => setShowShare(true)}>
                    <UserPlus size={16} />
                    <span>Compartilhar</span>
                </button>
            </div>

            <DragDropContext onDragEnd={handleDragEnd}>
                <div className="board-lists">
                    {board.lists.map(list => (
                        <BoardList
                            key={list.id}
                            list={list}
                            boardId={board.id}
                            onCardClick={onCardClick}
                        />
                    ))}

                    {/* Add List */}
                    <div className="board-add-list">
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
                </div>
            </DragDropContext>

            {showShare && <ShareModal boardTitle={board.title} onClose={() => setShowShare(false)} />}
        </div>
    );
}
