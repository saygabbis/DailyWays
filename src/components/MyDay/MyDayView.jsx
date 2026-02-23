import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
    Sun, Plus, Calendar, Sparkles, Focus, Play,
    MoreHorizontal, ArrowRight, Trash2, CheckCircle2
} from 'lucide-react';
import { format, isToday, isTomorrow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import SmartTaskItem from '../SmartViews/SmartTaskItem';
import './MyDay.css';

export default function MyDayView({ onCardClick }) {
    const { user } = useAuth();
    const { getMyDayCards, getPlannedCards, dispatch, persistBoard } = useApp();
    const [showFocus, setShowFocus] = useState(false);

    const cards = getMyDayCards();
    const completedCards = cards.filter(c => c.completed);
    const pendingCards = cards.filter(c => !c.completed);
    const progress = cards.length > 0 ? Math.round((completedCards.length / cards.length) * 100) : 0;
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

    // Tasks due today (for "add all" feature)
    const dueTodayNotInMyDay = getPlannedCards().filter(c => {
        if (c.myDay) return false;
        return isToday(new Date(c.dueDate));
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
        persistBoard(card.boardId);
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

    const clearCompleted = () => {
        const boardsToPersist = new Set();
        completedCards.forEach(card => {
            dispatch({
                type: 'UPDATE_CARD',
                payload: {
                    boardId: card.boardId,
                    listId: card.listId,
                    cardId: card.id,
                    updates: { myDay: false },
                },
            });
            boardsToPersist.add(card.boardId);
        });
        boardsToPersist.forEach(id => persistBoard(id));
    };

    const addAllDueToday = () => {
        const boardsToPersist = new Set();
        dueTodayNotInMyDay.forEach(card => {
            dispatch({
                type: 'UPDATE_CARD',
                payload: {
                    boardId: card.boardId,
                    listId: card.listId,
                    cardId: card.id,
                    updates: { myDay: true },
                },
            });
            boardsToPersist.add(card.boardId);
        });
        boardsToPersist.forEach(id => persistBoard(id));
    };

    // Progress ring SVG params
    const ringRadius = 28;
    const ringCircumference = 2 * Math.PI * ringRadius;
    const ringOffset = ringCircumference - (progress / 100) * ringCircumference;

    return (
        <div className="myday-view animate-slide-up">
            {/* Hero Header */}
            <div className="myday-hero">
                <div className="myday-hero-content">
                    <h1 className="myday-greeting">
                        {greeting}, <span className="myday-name">{user?.name?.split(' ')[0]}</span>
                    </h1>
                    <div className="myday-date-row">
                        <span className="myday-date">{todayStr}</span>
                        {cards.length > 0 && <span className="myday-count-badge">{pendingCards.length} pendentes</span>}
                    </div>
                </div>
                <div className="myday-hero-actions">
                    {cards.length > 0 && (
                        <>
                            {/* Progress Ring */}
                            <div className="myday-progress-ring" title={`${progress}% concluído`}>
                                <svg width="64" height="64" viewBox="0 0 64 64">
                                    <circle cx="32" cy="32" r={ringRadius} fill="none" stroke="var(--border-color)" strokeWidth="4" />
                                    <circle
                                        cx="32" cy="32" r={ringRadius} fill="none"
                                        stroke="var(--accent-primary)" strokeWidth="4"
                                        strokeDasharray={ringCircumference}
                                        strokeDashoffset={ringOffset}
                                        strokeLinecap="round"
                                        transform="rotate(-90 32 32)"
                                        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                                    />
                                </svg>
                                <span className="myday-progress-text">{progress}%</span>
                            </div>
                            <button
                                className={`btn btn-primary myday-focus-btn ${showFocus ? 'active' : ''}`}
                                onClick={() => setShowFocus(!showFocus)}
                            >
                                <Play size={16} fill="currentColor" />
                                Modo Foco
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Focus Mode Overlay */}
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
                        {dueTodayNotInMyDay.length > 0 && (
                            <button className="btn btn-primary myday-add-all-btn" onClick={addAllDueToday}>
                                <Calendar size={16} />
                                Adicionar {dueTodayNotInMyDay.length} tarefa{dueTodayNotInMyDay.length > 1 ? 's' : ''} de hoje
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Action Bar */}
                        {completedCards.length > 0 && (
                            <div className="myday-action-bar animate-slide-up">
                                <span className="myday-completed-label">
                                    <CheckCircle2 size={14} />
                                    {completedCards.length} concluída{completedCards.length > 1 ? 's' : ''}
                                </span>
                                <button className="btn btn-ghost btn-sm myday-clear-btn" onClick={clearCompleted}>
                                    <Trash2 size={14} />
                                    Limpar concluídas
                                </button>
                            </div>
                        )}

                        <div className="myday-tasks-list">
                            {cards.map((card, i) => (
                                <div key={card.id} className="animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
                                    <SmartTaskItem
                                        card={card}
                                        board={{ id: card.boardId, title: card.boardTitle, emoji: card.boardEmoji }}
                                        list={{ id: card.listId, title: card.listTitle }}
                                        onClick={() => onCardClick(card, card.boardId, card.listId)}
                                        onToggleMyDay={() => removeFromMyDay(card)}
                                        onToggleImportant={() => toggleImportant(card)}
                                        showLocation={true}
                                    />
                                </div>
                            ))}
                        </div>
                    </>
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
