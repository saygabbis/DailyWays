import { useApp } from '../../context/AppContext';
import { Star, AlertCircle, Sparkles } from 'lucide-react';
import SmartTaskItem from '../SmartViews/SmartTaskItem';
import './SmartViews.css';

export default function ImportantView({ onCardClick }) {
    const { getImportantCards, dispatch } = useApp();
    const cards = getImportantCards();

    // Group by priority
    const urgentCards = cards.filter(c => c.priority === 'urgent');
    const highCards = cards.filter(c => c.priority === 'high');
    const mediumCards = cards.filter(c => c.priority === 'medium');
    const lowCards = cards.filter(c => c.priority === 'low');
    const noPriorityCards = cards.filter(c => !c.priority || c.priority === 'none');

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

    const renderGroup = (title, items, color) => {
        if (items.length === 0) return null;
        return (
            <div className="smart-group animate-slide-up">
                <h3 className="smart-group-title" style={{ color }}>
                    {title} <span className="smart-group-count">{items.length}</span>
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
            <div className="smart-hero important-hero">
                <div className="smart-hero-content">
                    <h1>Importante</h1>
                    <p>{cards.length} tarefa{cards.length !== 1 ? 's' : ''} marcada{cards.length !== 1 ? 's' : ''} com estrela</p>
                </div>
                <div className="smart-hero-icon">
                    <Star size={48} strokeWidth={1.5} />
                </div>
            </div>

            {cards.length === 0 ? (
                <div className="smart-empty">
                    <div className="empty-icon-bg">
                        <Star size={48} />
                    </div>
                    <h3>Nenhuma tarefa importante</h3>
                    <p>Marque tarefas com a estrela para vê-las aqui.</p>
                </div>
            ) : (
                <div className="smart-content">
                    {renderGroup('🔴 Urgente', urgentCards, 'var(--priority-urgent)')}
                    {renderGroup('🟠 Alta Prioridade', highCards, 'var(--priority-high)')}
                    {renderGroup('🟡 Média Prioridade', mediumCards, 'var(--priority-medium)')}
                    {renderGroup('🔵 Baixa Prioridade', lowCards, 'var(--priority-low)')}
                    {renderGroup('⚪ Sem Prioridade', noPriorityCards, 'var(--text-tertiary)')}
                </div>
            )}
        </div>
    );
}
