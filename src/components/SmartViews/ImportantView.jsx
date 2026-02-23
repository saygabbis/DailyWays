import { useApp } from '../../context/AppContext';
import { Sun, Star, AlertTriangle, TrendingUp } from 'lucide-react';
import SmartTaskItem from './SmartTaskItem';
import './SmartViews.css';

export default function ImportantView({ onCardClick }) {
    const { getImportantCards, dispatch, persistBoard } = useApp();
    const cards = getImportantCards();

    // Categorize cards
    const starredCards = cards.filter(c => c.important);
    const urgentCards = cards.filter(c => c.priority === 'urgent');
    const highCards = cards.filter(c => c.priority === 'high' && !c.important);

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
        { key: 'starred', label: '⭐ Marcadas', cards: starredCards, color: 'var(--warning)' },
        { key: 'urgent', label: '🔴 Urgentes', cards: urgentCards, color: 'var(--danger)' },
        { key: 'high', label: '🟠 Alta prioridade', cards: highCards, color: '#f97316' },
    ].filter(g => g.cards.length > 0);

    return (
        <div className="smart-view animate-slide-up">
            {/* Hero */}
            <div className="smart-view-hero important-hero">
                <div className="smart-view-hero-content">
                    <h1><Star size={28} /> Importante</h1>
                    <p className="smart-view-subtitle">Tarefas que precisam da sua atenção</p>
                </div>

                {/* Summary Chips */}
                {cards.length > 0 && (
                    <div className="smart-summary-chips">
                        {urgentCards.length > 0 && (
                            <span className="summary-chip chip-urgent">
                                <AlertTriangle size={13} /> {urgentCards.length} urgente{urgentCards.length > 1 ? 's' : ''}
                            </span>
                        )}
                        {highCards.length > 0 && (
                            <span className="summary-chip chip-high">
                                <TrendingUp size={13} /> {highCards.length} alta{highCards.length > 1 ? 's' : ''}
                            </span>
                        )}
                        {starredCards.length > 0 && (
                            <span className="summary-chip chip-starred">
                                <Star size={13} /> {starredCards.length} marcada{starredCards.length > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="smart-view-content">
                {cards.length === 0 ? (
                    <div className="smart-empty state-empty">
                        <div className="empty-icon-bg">
                            <Star size={48} />
                        </div>
                        <h3>Nenhuma tarefa importante</h3>
                        <p>Tarefas com estrela ou prioridade alta/urgente aparecem aqui</p>
                    </div>
                ) : (
                    groups.map(group => (
                        <div key={group.key} className="smart-group">
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
