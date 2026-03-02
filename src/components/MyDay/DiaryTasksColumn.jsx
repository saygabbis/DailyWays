import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Sun, Star, Calendar, Sparkles, ChevronDown, Trash2, CheckCircle2 } from 'lucide-react';
import { format, isToday, isTomorrow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import SmartTaskItem from '../SmartViews/SmartTaskItem';

export default function DiaryTasksColumn({ onCardClick }) {
    const { getMyDayCards, getPlannedCards, dispatch, persistBoard } = useApp();
    const [selectedBoardId, setSelectedBoardId] = useState('all');

    const allMyDayCards = getMyDayCards();

    const boardOptions = useMemo(() => {
        const map = new Map();
        allMyDayCards.forEach(card => {
            if (!card.boardId) return;
            const existing = map.get(card.boardId) || {
                id: card.boardId,
                title: card.boardTitle,
                emoji: card.boardEmoji,
                count: 0,
            };
            existing.count += 1;
            map.set(card.boardId, existing);
        });
        return Array.from(map.values()).sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }, [allMyDayCards]);

    const visibleCards = selectedBoardId === 'all'
        ? allMyDayCards
        : allMyDayCards.filter(c => c.boardId === selectedBoardId);

    const completedCards = visibleCards.filter(c => c.completed);
    const pendingCards = visibleCards.filter(c => !c.completed);

    const suggestionsRaw = getPlannedCards().filter(c => {
        if (c.myDay) return false;
        if (!c.dueDate) return false;
        const d = new Date(c.dueDate);
        return isToday(d) || isTomorrow(d);
    });

    const dueTodayNotInMyDayRaw = getPlannedCards().filter(c => {
        if (c.myDay) return false;
        if (!c.dueDate) return false;
        return isToday(new Date(c.dueDate));
    });

    const suggestions = selectedBoardId === 'all'
        ? suggestionsRaw
        : suggestionsRaw.filter(c => c.boardId === selectedBoardId);

    const dueTodayNotInMyDay = selectedBoardId === 'all'
        ? dueTodayNotInMyDayRaw
        : dueTodayNotInMyDayRaw.filter(c => c.boardId === selectedBoardId);

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

    const currentBoardLabel = (() => {
        if (selectedBoardId === 'all') return 'Todos os boards';
        const b = boardOptions.find(b => b.id === selectedBoardId);
        if (!b) return 'Board removido';
        return `${b.emoji ?? '📋'} ${b.title}`;
    })();

    const totalMyDay = allMyDayCards.length;

    return (
        <section className="diary-column diary-column-left">
            <div className="diary-column-header">
                <div>
                    <div className="diary-column-title">
                        Meu Dia – Pendentes
                    </div>
                    <div className="diary-column-subtitle">
                        {pendingCards.length} tarefa{pendingCards.length !== 1 ? 's' : ''} pendente
                        {selectedBoardId === 'all' ? '' : ' neste board'}
                    </div>
                </div>
                <div className="diary-column-header-actions">
                    <button
                        type="button"
                        className="diary-board-filter-btn"
                        onClick={(e) => {
                            const menu = e.currentTarget.nextElementSibling;
                            if (menu) menu.classList.toggle('open');
                        }}
                    >
                        <span className="diary-board-filter-label">{currentBoardLabel}</span>
                        <ChevronDown size={14} />
                    </button>
                    <div className="diary-board-filter-menu">
                        <button
                            type="button"
                            className={`diary-board-filter-item ${selectedBoardId === 'all' ? 'active' : ''}`}
                            onClick={() => { setSelectedBoardId('all'); }}
                        >
                            <span>Todos os boards</span>
                            {totalMyDay > 0 && <span className="diary-board-filter-count">{totalMyDay}</span>}
                        </button>
                        {boardOptions.map(board => (
                            <button
                                key={board.id}
                                type="button"
                                className={`diary-board-filter-item ${selectedBoardId === board.id ? 'active' : ''}`}
                                onClick={() => { setSelectedBoardId(board.id); }}
                            >
                                <span>{board.emoji ?? '📋'} {board.title}</span>
                                <span className="diary-board-filter-count">{board.count}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {visibleCards.length === 0 ? (
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

                    <div className="diary-tasks-scroll">
                        {visibleCards.map((card, i) => (
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
                                        {isToday(new Date(card.dueDate)) ? 'Vence hoje' : 'Vence amanhã'} ·{' '}
                                        {format(new Date(card.dueDate), 'dd MMM', { locale: ptBR })}
                                    </span>
                                </div>
                                <button className="btn-icon-add" onClick={() => addToMyDay(card)}>
                                    <Sun size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}

