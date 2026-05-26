import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { useBoardCollabDispatch } from '../../../collab/board/ops/BoardCollabContext.jsx';
import { uuidv4 } from '../../../utils/uuid';
import { DAY_CATEGORIES } from './diaryHubConfig';
import DiaryMissionTaskRow from './DiaryMissionTaskRow';
import DiaryEmptyState from './DiaryEmptyState';

export default function DiaryMissionSection({
    categoryId,
    cards,
    onCardClick,
    onTaskCompleted,
}) {
    const { state, getActiveBoard } = useApp();
    const boards = state.boards || [];
    const board = getActiveBoard() || boards[0];
    const { collabDispatch } = useBoardCollabDispatch(board?.id);
    const [title, setTitle] = useState('');
    const cat = DAY_CATEGORIES[categoryId];

    const handleAdd = (e) => {
        e.preventDefault();
        const trimmed = title.trim();
        if (!trimmed) return;

        if (!board) return;
        const list = board.lists.find(l => !l.isCompletionList) || board.lists[0];
        if (!list) return;

        collabDispatch({
            type: 'ADD_CARD',
            payload: {
                boardId: board.id,
                listId: list.id,
                title: trimmed,
                cardData: {
                    id: uuidv4(),
                    myDay: true,
                    dayCategory: categoryId,
                },
            },
        });
        setTitle('');
    };

    return (
        <div className="diary-mission-section">
            <div className="diary-mission-section-header">
                <div>
                    <h3 className="diary-mission-section-title">
                        {cat.emoji} {cat.label}
                    </h3>
                    <p className="diary-mission-section-sub">{cat.subtitle}</p>
                </div>
            </div>

            <form className="diary-mission-mini-add" onSubmit={handleAdd}>
                <input
                    type="text"
                    className="diary-mission-mini-input"
                    placeholder={`Nova missão ${cat.label.toLowerCase()}...`}
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                />
                <button type="submit" className="diary-mission-mini-btn" disabled={!title.trim()} aria-label="Adicionar">
                    <Plus size={18} />
                </button>
            </form>

            <div className="diary-mission-list">
                {cards.length === 0 ? (
                    <DiaryEmptyState
                        title="Nada aqui ainda"
                        description="Tudo bem — adicione quando fizer sentido."
                    />
                ) : (
                    cards.map(card => (
                        <DiaryMissionTaskRow
                            key={card.id}
                            card={card}
                            onClick={() => onCardClick(card, card.boardId, card.listId)}
                            onTaskCompleted={onTaskCompleted}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
