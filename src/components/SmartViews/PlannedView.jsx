import { useApp } from '../../context/AppContext';
import { CalendarDays, AlertCircle, Clock } from 'lucide-react';
import { format, isPast, isToday, isTomorrow, isThisWeek, compareAsc, addDays, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import SmartTaskItem from './SmartTaskItem';
import './SmartViews.css';

export default function PlannedView({ onCardClick }) {
    const { getPlannedCards, dispatch } = useApp();
    const cards = getPlannedCards().sort((a, b) =>
        compareAsc(new Date(a.dueDate), new Date(b.dueDate))
    );

    const toggleImportant = (card) => {
        dispatch({
            type: 'UPDATE_CARD',
            payload: {
                boardId: card.boardId,
                listId: card.listId,
                cardId: card.id,
                updates: { important: !card.important },
            },
        });
    };

    // Grouping Logic
    const overdue = cards.filter(c => isPast(new Date(c.dueDate)) && !isToday(new Date(c.dueDate)));
    const today = cards.filter(c => isToday(new Date(c.dueDate)));
    const tomorrow = cards.filter(c => isTomorrow(new Date(c.dueDate)));

    // "This Week" means next 7 days excluding today/tomorrow
    const weekEnd = addDays(new Date(), 7);
    const thisWeek = cards.filter(c => {
        const d = new Date(c.dueDate);
        return isAfter(d, addDays(new Date(), 1)) && !isAfter(d, weekEnd);
    });

    const later = cards.filter(c => {
        const d = new Date(c.dueDate);
        return isAfter(d, weekEnd);
    });

    const renderGroup = (title, items, color, icon) => {
        if (items.length === 0) return null;
        return (
            <div className="smart-group animate-slide-up">
                <h3 className="smart-group-title" style={{ color }}>
                    {icon} {title} <span className="smart-group-count">{items.length}</span>
                </h3>
                <div className="smart-tasks-list">
                    {items.map(card => (
                        <SmartTaskItem
                            key={card.id}
                            card={card}
                            board={{ id: card.boardId, title: card.boardTitle, emoji: card.boardEmoji }}
                            list={{ id: card.listId, title: card.listTitle }}
                            onClick={() => onCardClick(card, card.boardId, card.listId)}
                            onToggleImportant={() => toggleImportant(card)}
                            showLocation={true}
                        />
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="smart-view">
            <div className="smart-hero planned-hero">
                <div className="smart-hero-content">
                    <h1>Planejado</h1>
                    <p>{cards.length} tarefa{cards.length !== 1 ? 's' : ''} com data de vencimento</p>
                </div>
                <div className="smart-hero-icon">
                    <CalendarDays size={48} strokeWidth={1.5} />
                </div>
            </div>

            {cards.length === 0 ? (
                <div className="smart-empty">
                    <div className="empty-icon-bg">
                        <CalendarDays size={48} />
                    </div>
                    <h3>Nenhuma tarefa planejada</h3>
                    <p>Defina datas de vencimento nas suas tarefas para se organizar.</p>
                </div>
            ) : (
                <div className="smart-content">
                    {renderGroup('Atrasadas', overdue, 'var(--danger)', <AlertCircle size={16} />)}
                    {renderGroup('Hoje', today, 'var(--accent-primary)', <Clock size={16} />)}
                    {renderGroup('Amanhã', tomorrow, 'var(--success)', <Clock size={16} />)}
                    {renderGroup('Próximos 7 dias', thisWeek, 'var(--info)', <CalendarDays size={16} />)}
                    {renderGroup('Mais tarde', later, 'var(--text-tertiary)', <CalendarDays size={16} />)}
                </div>
            )}
        </div>
    );
}
