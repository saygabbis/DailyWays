import { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
    Search, X, Filter, Calendar, Star, Tag, Clock,
    ArrowRight, CheckCircle2
} from 'lucide-react';
import './SearchOverlay.css';

export default function SearchOverlay({ onClose, onCardClick }) {
    const { state } = useApp();
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all'); // all, today, important, completed
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    // Gather all searchable items (cards and subtasks)
    const allSearchableItems = useMemo(() => {
        const items = [];
        state.boards.forEach(board => {
            board.lists.forEach(list => {
                list.cards.forEach(card => {
                    // Add the card itself
                    const cardItem = {
                        type: 'card',
                        ...card,
                        boardId: board.id,
                        listId: list.id,
                        boardTitle: board.title,
                        boardEmoji: board.emoji,
                        listTitle: list.title
                    };
                    items.push(cardItem);

                    // Add subtasks as separate searchable items
                    card.subtasks?.forEach(st => {
                        items.push({
                            type: 'subtask',
                            id: st.id,
                            title: st.title,
                            completed: st.done,
                            parentCardId: card.id,
                            parentCardTitle: card.title,
                            boardId: board.id,
                            listId: list.id,
                            boardTitle: board.title,
                            boardEmoji: board.emoji,
                            listTitle: list.title,
                            // Inherit useful meta for filtering
                            important: card.important,
                            myDay: card.myDay,
                            dueDate: card.dueDate,
                            priority: card.priority
                        });
                    });
                });
            });
        });
        return items;
    }, [state.boards]);

    // Filter + search
    const results = useMemo(() => {
        let filtered = allSearchableItems;

        // Apply filter
        if (filter === 'today') {
            const today = new Date().toISOString().split('T')[0];
            filtered = filtered.filter(c => c.myDay || c.dueDate === today);
        } else if (filter === 'important') {
            filtered = filtered.filter(c => c.important || (c.type === 'card' && c.priority === 'high'));
        } else if (filter === 'completed') {
            filtered = filtered.filter(c => c.completed);
        }

        // Apply search query
        if (query.trim()) {
            const q = query.toLowerCase();
            filtered = filtered.filter(c =>
                c.title?.toLowerCase().includes(q) ||
                (c.type === 'card' && (
                    c.description?.toLowerCase().includes(q) ||
                    c.labels?.some(l => l.toLowerCase().includes(q))
                )) ||
                (c.type === 'subtask' && c.parentCardTitle?.toLowerCase().includes(q))
            );
        }

        return filtered.slice(0, 20); // max 20 results
    }, [allSearchableItems, query, filter]);

    const filters = [
        { id: 'all', label: 'Todos', icon: Search },
        { id: 'today', label: 'Hoje', icon: Clock },
        { id: 'important', label: 'Importante', icon: Star },
        { id: 'completed', label: 'Concluídos', icon: CheckCircle2 },
    ];

    const handleCardSelect = (card) => {
        onCardClick?.(card, card.boardId, card.listId);
        onClose();
    };

    const getPriorityColor = (p) => {
        const map = { urgent: 'var(--priority-urgent)', high: 'var(--priority-high)', medium: 'var(--priority-medium)', low: 'var(--priority-low)' };
        return map[p] || 'var(--text-tertiary)';
    };

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="search-overlay animate-scale-in-centered">
                {/* Search input */}
                <div className="search-overlay-header">
                    <Search size={20} className="search-overlay-icon" />
                    <input
                        ref={inputRef}
                        type="text"
                        className="search-overlay-input"
                        placeholder="Buscar tarefas, boards, labels..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                    <button className="btn-icon" onClick={onClose}><X size={18} /></button>
                </div>

                {/* Filter pills */}
                <div className="search-filters">
                    {filters.map(f => (
                        <button
                            key={f.id}
                            className={`search-filter-pill ${filter === f.id ? 'active' : ''}`}
                            onClick={() => setFilter(f.id)}
                        >
                            <f.icon size={14} />
                            <span>{f.label}</span>
                        </button>
                    ))}
                </div>

                {/* Results */}
                <div className="search-results">
                    {results.length === 0 && (
                        <div className="search-empty">
                            <Search size={40} />
                            <p>{query ? 'Nenhum resultado encontrado' : 'Digite para buscar tarefas'}</p>
                        </div>
                    )}
                    {results.map(item => (
                        <button key={item.id} className={`search-result-item ${item.type === 'subtask' ? 'is-subtask' : ''}`} onClick={() => handleCardSelect(item.type === 'card' ? item : { id: item.parentCardId, boardId: item.boardId, listId: item.listId })}>
                            <div className="search-result-main">
                                <div className="search-result-title">
                                    {item.completed && <CheckCircle2 size={14} className="search-result-check" />}
                                    <span className={item.completed ? 'completed-text' : ''}>
                                        {item.type === 'subtask' && <span className="search-subtask-indicator">↳</span>}
                                        {item.title}
                                    </span>
                                    {item.important && <Star size={12} className="search-result-star" />}
                                </div>
                                <div className="search-result-meta">
                                    {item.type === 'subtask' && (
                                        <>
                                            <span className="search-parent-card">Em: {item.parentCardTitle}</span>
                                            <span className="dot-separator">•</span>
                                        </>
                                    )}
                                    <span className="search-result-board">{item.boardEmoji} {item.boardTitle}</span>
                                    <ArrowRight size={10} />
                                    <span>{item.listTitle}</span>
                                    {item.priority && item.priority !== 'none' && (
                                        <span className="search-result-priority" style={{ color: getPriorityColor(item.priority) }}>
                                            ● {item.priority}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Suggestions */}
                {!query && filter === 'all' && (
                    <div className="search-suggestions">
                        <span className="search-suggestions-label">Sugestões rápidas</span>
                        <div className="search-suggestion-chips">
                            <button className="search-chip" onClick={() => setFilter('today')}>📅 Tarefas de hoje</button>
                            <button className="search-chip" onClick={() => setFilter('important')}>⭐ Importantes</button>
                            <button className="search-chip" onClick={() => setQuery('urgent')}>🔴 Urgentes</button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
