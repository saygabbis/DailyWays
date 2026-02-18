import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
    Sun, Plus, Calendar, Sparkles, Focus, Play,
    MoreHorizontal, ArrowRight
} from 'lucide-react';
import { format, isToday, isTomorrow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import SmartTaskItem from '../SmartViews/SmartTaskItem';
import './MyDay.css';

export default function MyDayView({ onCardClick }) {
    const { user } = useAuth();
    const { getMyDayCards, getPlannedCards, dispatch } = useApp();
    const [showFocus, setShowFocus] = useState(false);

    const cards = getMyDayCards();
    const now = new Date();
    const hour = now.getHours();

    let greeting = 'Bom dia';
    if (hour >= 12 && hour < 18) greeting = 'Boa tarde';
    if (hour >= 18) greeting = 'Boa noite';

    const todayStr = format(now, "EEEE, d 'de' MMMM", { locale: ptBR });

    // Suggested tasks (due today/tomorrow, not already in My Day)
    const suggestions = getPlannedCards().filter(c => {
        if (c.myDay) return false;
        const d = new Date(c.dueDate);
        return isToday(d) || isTomorrow(d);
    });

    const addToMyDay = (card) => {
        dispatch({
            type: 'UPDATE_CARD',
            payload: {
                boardId: card.boardId,
                listId: card.listId,
                cardId: card.id,
                updates: { myDay: true },
            },
        });
    };

    const removeFromMyDay = (card) => {
        dispatch({
            type: 'UPDATE_CARD',
            payload: {
                boardId: card.boardId,
                listId: card.listId,
                cardId: card.id,
                updates: { myDay: false },
            },
        });
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
    }

    return (
        <div className="myday-view animate-fade-in">
            {/* Hero Header */}
            <div className="myday-hero">
                <div className="myday-hero-content">
                    <h1 className="myday-greeting">
                        {greeting}, <span className="myday-name">{user?.name?.split(' ')[0]}</span>
                    </h1>
                    <div className="myday-date-row">
                        <span className="myday-date">{todayStr}</span>
                        {cards.length > 0 && <span className="myday-count-badge">{cards.length} tarefas</span>}
                    </div>
                </div>
                {cards.length > 0 && (
                    <button
                        className={`btn btn-primary myday-focus-btn ${showFocus ? 'active' : ''}`}
                        onClick={() => setShowFocus(!showFocus)}
                    >
                        <Play size={16} fill="currentColor" />
                        Modo Foco
                    </button>
                )}
            </div>

            {/* Focus Mode Overlay (Placeholder for now, later Pomodoro) */}
            {showFocus && cards.length > 0 && (
                <div className="myday-focus-highlight animate-scale-in">
                    <div className="focus-label">FOCAR AGORA</div>
                    <div className="focus-card-preview">
                        <h2>{cards[0].title}</h2>
                        <span className="focus-subtitle">
                            {cards[0].boardTitle} • {cards[0].listTitle}
                        </span>
                    </div>
                    <div className="focus-actions">
                        <button className="btn btn-primary">Iniciar Timer (25m)</button>
                    </div>
                </div>
            )}

            {/* Tasks List */}
            <div className="myday-content">
                {cards.length === 0 ? (
                    <div className="myday-empty state-empty">
                        <div className="empty-icon-bg">
                            <Sun size={48} />
                        </div>
                        <h3>Seu dia está limpo!</h3>
                        <p>Que tal começar adicionando algumas tarefas?</p>
                    </div>
                ) : (
                    <div className="myday-tasks-list">
                        {cards.map((card, i) => (
                            <SmartTaskItem
                                key={card.id}
                                card={card}
                                board={{ id: card.boardId, title: card.boardTitle, emoji: card.boardEmoji }}
                                list={{ id: card.listId, title: card.listTitle }}
                                onClick={() => onCardClick(card, card.boardId, card.listId)}
                                onToggleMyDay={() => removeFromMyDay(card)}
                                onToggleImportant={() => toggleImportant(card)}
                                showLocation={true}
                            />
                        ))}
                    </div>
                )}

                {/* Suggestions */}
                {suggestions.length > 0 && (
                    <div className="myday-suggestions-section">
                        <h3 className="section-title">
                            <Sparkles size={16} /> Sugestões para hoje
                        </h3>
                        <div className="suggestions-grid">
                            {suggestions.slice(0, 4).map(card => (
                                <div key={card.id} className="suggestion-card">
                                    <div className="suggestion-info">
                                        <span className="suggestion-title">{card.title}</span>
                                        <span className="suggestion-meta">
                                            {isToday(new Date(card.dueDate)) ? 'Vence hoje' : 'Vence amanhã'}
                                        </span>
                                    </div>
                                    <button className="btn-icon-add" onClick={() => addToMyDay(card)}>
                                        <Plus size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
