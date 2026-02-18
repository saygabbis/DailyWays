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

    // Gather all cards from all boards with board/list context
    const allCards = useMemo(() => {
        const cards = [];
        state.boards.forEach(board => {
            board.lists.forEach(list => {
                list.cards.forEach(card => {
                    cards.push({ ...card, boardId: board.id, listId: list.id, boardTitle: board.title, boardEmoji: board.emoji, listTitle: list.title });
                });
            });
        });
        return cards;
    }, [state.boards]);

    // Filter + search
    const results = useMemo(() => {
        let filtered = allCards;

        // Apply filter
        if (filter === 'today') {
            const today = new Date().toISOString().split('T')[0];
            filtered = filtered.filter(c => c.myDay || c.dueDate === today);
        } else if (filter === 'important') {
            filtered = filtered.filter(c => c.important);
        } else if (filter === 'completed') {
            filtered = filtered.filter(c => c.completed);
        }

        // Apply search query
        if (query.trim()) {
            const q = query.toLowerCase();
            filtered = filtered.filter(c =>
                c.title?.toLowerCase().includes(q) ||
                c.description?.toLowerCase().includes(q) ||
                c.labels?.some(l => l.toLowerCase().includes(q))
            );
        }

        return filtered.slice(0, 20); // max 20 results
    }, [allCards, query, filter]);

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
            <div className="search-overlay animate-scale-in">
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
                    {results.map(card => (
                        <button key={card.id} className="search-result-item" onClick={() => handleCardSelect(card)}>
                            <div className="search-result-main">
                                <div className="search-result-title">
                                    {card.completed && <CheckCircle2 size={14} className="search-result-check" />}
                                    <span className={card.completed ? 'completed-text' : ''}>{card.title}</span>
                                    {card.important && <Star size={12} className="search-result-star" />}
                                </div>
                                <div className="search-result-meta">
                                    <span className="search-result-board">{card.boardEmoji} {card.boardTitle}</span>
                                    <ArrowRight size={10} />
                                    <span>{card.listTitle}</span>
                                    {card.priority && card.priority !== 'none' && (
                                        <span className="search-result-priority" style={{ color: getPriorityColor(card.priority) }}>
                                            ● {card.priority}
                                        </span>
                                    )}
                                    {card.dueDate && (
                                        <span className="search-result-date">
                                            <Calendar size={10} /> {card.dueDate}
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
