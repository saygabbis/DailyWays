import { useApp } from '../../context/AppContext';
import {
    Calendar, Star, Sun, CheckCircle2, Circle, AlertCircle,
    ArrowRight, CheckSquare, Clock
} from 'lucide-react';
import { format, isPast, isToday, isTomorrow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import './SmartTaskItem.css';

export default function SmartTaskItem({ card, board, list, onClick, onToggleMyDay, onToggleImportant, showLocation = true }) {
    const { dispatch, LABEL_COLORS, persistBoard } = useApp();

    const handleToggleComplete = (e) => {
        e.stopPropagation();
        dispatch({
            type: 'UPDATE_CARD',
            payload: {
                boardId: board.id,
                listId: list.id,
                cardId: card.id,
                updates: { completed: !card.completed }
            }
        });
        persistBoard(board.id);
    };

    const priorityColor = {
        urgent: 'var(--priority-urgent)',
        high: 'var(--priority-high)',
        medium: 'var(--priority-medium)',
        low: 'var(--priority-low)',
        none: 'transparent'
    }[card.priority || 'none'];

    const doneSubtasks = card.subtasks?.filter(st => st.done).length || 0;
    const totalSubtasks = card.subtasks?.length || 0;

    return (
        <div
            className={`smart-task-item ${card.completed ? 'completed' : ''}`}
            onClick={onClick}
        >
            {/* Selection / Completion Status */}
            <button
                className={`smart-task-check ${card.priority === 'urgent' && !card.completed ? 'urgent-ring' : ''}`}
                onClick={handleToggleComplete}
            >
                {card.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
            </button>

            <div className="smart-task-content">
                <div className="smart-task-header">
                    <span className="smart-task-title">{card.title}</span>
                    {card.priority && card.priority !== 'none' && !card.completed && (
                        <span className="smart-task-priority-tag" style={{ color: priorityColor, borderColor: priorityColor }}>
                            {card.priority}
                        </span>
                    )}
                </div>

                <div className="smart-task-meta">
                    {showLocation && (
                        <span className="smart-task-location">
                            {board.emoji} {board.title} <ArrowRight size={10} /> {list.title}
                        </span>
                    )}

                    {card.dueDate && (
                        <span className={`smart-task-date ${isPast(new Date(card.dueDate)) && !isToday(new Date(card.dueDate)) && !card.completed ? 'overdue' : ''}`}>
                            <Calendar size={12} />
                            {isToday(new Date(card.dueDate)) ? 'Hoje' :
                                isTomorrow(new Date(card.dueDate)) ? 'Amanhã' :
                                    format(new Date(card.dueDate), 'dd MMM', { locale: ptBR })}
                        </span>
                    )}

                    {totalSubtasks > 0 && (
                        <span className="smart-task-subtasks">
                            <CheckSquare size={12} />
                            {doneSubtasks}/{totalSubtasks}
                        </span>
                    )}

                    {card.labels?.length > 0 && (
                        <div className="smart-task-labels">
                            {card.labels.map(lid => {
                                const l = LABEL_COLORS.find(x => x.id === lid);
                                if (!l) return null;
                                return <span key={lid} className="smart-task-label-dot" style={{ background: l.color }} title={l.name} />;
                            })}
                        </div>
                    )}
                </div>
            </div>

            <div className="smart-task-actions">
                {onToggleMyDay && (
                    <button
                        className={`smart-task-action-btn ${card.myDay ? 'active-myday' : ''}`}
                        onClick={(e) => { e.stopPropagation(); onToggleMyDay(card); }}
                        title={card.myDay ? 'Remover de Meu Dia' : 'Adicionar a Meu Dia'}
                    >
                        <Sun size={16} fill={card.myDay ? 'currentColor' : 'none'} />
                    </button>
                )}
                {onToggleImportant && (
                    <button
                        className={`smart-task-action-btn ${card.important ? 'active-star' : ''}`}
                        onClick={(e) => { e.stopPropagation(); onToggleImportant(card); }}
                        title={card.important ? 'Remover importância' : 'Marcar como importante'}
                    >
                        <Star size={16} fill={card.important ? 'currentColor' : 'none'} />
                    </button>
                )}
            </div>
        </div>
    );
}
