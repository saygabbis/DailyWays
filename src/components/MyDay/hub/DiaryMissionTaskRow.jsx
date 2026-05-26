import { useBoardCollabDispatch } from '../../../collab/board/ops/BoardCollabContext.jsx';
import { useSmartViewCardCompletion } from '../../../hooks/useSmartViewCardCompletion';
import { CheckCircle2, Circle, Clock, Star, X } from 'lucide-react';
import { getEstimatedMinutes } from './diaryHubUtils';
import { updatesToggleImportant } from '../../../utils/cardImportant';

export default function DiaryMissionTaskRow({ card, onClick, onTaskCompleted }) {
    const { collabDispatch } = useBoardCollabDispatch(card.boardId);
    const { toggleCardCompletion } = useSmartViewCardCompletion();

    const handleToggle = async (e) => {
        e.stopPropagation();
        const markComplete = !card.completed;
        await toggleCardCompletion(card, { id: card.boardId }, { id: card.listId }, markComplete);
        if (markComplete && card.myDay) {
            onTaskCompleted?.({ ...card, completed: true });
        }
    };

    const handleRemoveFromDay = (e) => {
        e.stopPropagation();
        collabDispatch({
            type: 'UPDATE_CARD',
            payload: {
                boardId: card.boardId,
                listId: card.listId,
                cardId: card.id,
                updates: { myDay: false },
            },
        });
    };

    const handleToggleImportant = (e) => {
        e.stopPropagation();
        collabDispatch({
            type: 'UPDATE_CARD',
            payload: {
                boardId: card.boardId,
                listId: card.listId,
                cardId: card.id,
                updates: updatesToggleImportant(card),
            },
        });
    };

    const minutes = getEstimatedMinutes(card);

    return (
        <div
            className={`diary-mission-row ${card.completed ? 'completed' : ''}`}
            onClick={() => onClick?.(card)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onClick?.(card)}
        >
            <button type="button" className="diary-mission-check" onClick={handleToggle} aria-label="Concluir">
                {card.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
            </button>
            <div className="diary-mission-row-body">
                <span className="diary-mission-row-title">{card.title}</span>
                {minutes != null && (
                    <span className="diary-mission-row-time">
                        <Clock size={12} />
                        {minutes} min
                    </span>
                )}
            </div>
            <div className="diary-mission-row-actions">
                <button type="button" className="btn-icon btn-xs" onClick={handleToggleImportant} title="Importante">
                    <Star size={14} />
                </button>
                <button type="button" className="btn-icon btn-xs" onClick={handleRemoveFromDay} title="Remover do dia">
                    <X size={14} />
                </button>
            </div>
        </div>
    );
}
