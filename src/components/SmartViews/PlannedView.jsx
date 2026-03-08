import { useApp } from '../../context/AppContext';
import { CalendarDays, AlertTriangle, Sun } from 'lucide-react';
import { isToday, isTomorrow, isPast, isThisWeek, format, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import SmartTaskItem from './SmartTaskItem';
import './SmartViews.css';

export default function PlannedView({ onCardClick }) {
    const { getPlannedCards, dispatch, persistBoard } = useApp();
    const cards = getPlannedCards();
    const today = startOfDay(new Date());

    // Categorize
    const overdue = cards.filter(c => {
        const d = startOfDay(new Date(c.dueDate));
        return isPast(d) && !isToday(d) && !c.completed;
    });
    const todayCards = cards.filter(c => isToday(new Date(c.dueDate)));
    const tomorrowCards = cards.filter(c => isTomorrow(new Date(c.dueDate)));
    const thisWeekCards = cards.filter(c => {
        const d = new Date(c.dueDate);
        return isThisWeek(d, { weekStartsOn: 1 }) && !isToday(d) && !isTomorrow(d) && !isPast(startOfDay(d));
    });
    const laterCards = cards.filter(c => {
        const d = new Date(c.dueDate);
        return !isThisWeek(d, { weekStartsOn: 1 }) && !isPast(startOfDay(d));
    });

    const toggleMyDay = (card) => {
        dispatch({
            type: 'UPDATE_CARD',
            payload: {
                boardId: card.boardId,
                listId: card.listId,
                cardId: card.id,
                updates: { myDay: !card.myDay },
            },
        });
        persistBoard(card.boardId);
    };

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
        persistBoard(card.boardId);
    };

    const groups = [
        { key: 'overdue', label: '⚠️ Atrasadas', cards: overdue, color: 'var(--danger)', isOverdue: true },
        { key: 'today', label: '📌 Hoje', cards: todayCards, color: 'var(--accent-primary)' },
        { key: 'tomorrow', label: '➡️ Amanhã', cards: tomorrowCards, color: 'var(--success)' },
        { key: 'week', label: '📅 Esta semana', cards: thisWeekCards, color: 'var(--info)' },
        { key: 'later', label: '🗓️ Mais tarde', cards: laterCards, color: 'var(--text-tertiary)' },
    ].filter(g => g.cards.length > 0);

    // Build a simple timeline dots for the next 14 days
    const timelineDays = [];
    for (let i = 0; i < 14; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        const dayStr = format(d, 'yyyy-MM-dd');
        const count = cards.filter(c => c.dueDate === dayStr).length;
        timelineDays.push({
            day: format(d, 'EEE', { locale: ptBR }),
            date: format(d, 'dd'),
            count,
            isToday: i === 0,
        });
    }

    return (
        <div className="smart-view animate-slide-up">
            {/* Hero */}
            <div className="smart-view-hero planned-hero">
                <div className="smart-view-hero-content">
                    <h1><CalendarDays size={28} /> Planejado</h1>
                    <p className="smart-view-subtitle">{cards.length} tarefas agendadas</p>
                </div>

                {/* Overdue Badge */}
                {overdue.length > 0 && (
                    <div className="planned-overdue-badge">
                        <AlertTriangle size={16} />
                        <span>{overdue.length} atrasada{overdue.length > 1 ? 's' : ''}</span>
                    </div>
                )}
            </div>

            {/* Timeline Bar */}
            {cards.length > 0 && (
                <div className="planned-timeline">
                    {timelineDays.map((d, i) => (
                        <div key={i} className={`timeline-day ${d.isToday ? 'today' : ''} ${d.count > 0 ? 'has-tasks' : ''}`}>
                            <span className="timeline-day-label">{d.day}</span>
                            <span className="timeline-day-date">{d.date}</span>
                            {d.count > 0 && (
                                <div className="timeline-dots">
                                    {Array.from({ length: Math.min(d.count, 3) }).map((_, j) => (
                                        <span key={j} className="timeline-dot" />
                                    ))}
                                    {d.count > 3 && <span className="timeline-dot-more">+{d.count - 3}</span>}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Content */}
            <div className="smart-view-content">
                {cards.length === 0 ? (
                    <div className="smart-empty state-empty">
                        <div className="empty-icon-bg">
                            <CalendarDays size={48} />
                        </div>
                        <h3>Sem tarefas planejadas</h3>
                        <p>Arraste cards do board para o "Planejado" na sidebar para agendar</p>
                    </div>
                ) : (
                    groups.map(group => (
                        <div key={group.key} className={`smart-group ${group.isOverdue ? 'overdue-group' : ''}`}>
                            <div className="smart-group-header">
                                <span className="smart-group-label">{group.label}</span>
                                <span className="smart-group-count" style={{ color: group.color }}>
                                    {group.cards.length}
                                </span>
                            </div>
                            <div className="smart-group-tasks">
                                {group.cards.map((card, i) => (
                                    <div key={card.id} className="animate-slide-up" style={{ animationDelay: `${i * 40}ms` }}>
                                        <SmartTaskItem
                                            card={card}
                                            board={{ id: card.boardId, title: card.boardTitle, emoji: card.boardEmoji }}
                                            list={{ id: card.listId, title: card.listTitle }}
                                            onClick={() => onCardClick(card, card.boardId, card.listId)}
                                            onToggleMyDay={() => toggleMyDay(card)}
                                            onToggleImportant={() => toggleImportant(card)}
                                            showLocation={true}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
