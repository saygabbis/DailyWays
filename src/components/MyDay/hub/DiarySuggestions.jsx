import { useMemo, useState } from 'react';
import { isToday, isTomorrow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronDown, Sparkles, Plus } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { useBoardCollabDispatch } from '../../../collab/board/ops/BoardCollabContext.jsx';
import DiaryGlassCard from './DiaryGlassCard';

export default function DiarySuggestions({ onCardClick }) {
    const { getPlannedCards } = useApp();
    const { collabDispatch } = useBoardCollabDispatch();
    const [open, setOpen] = useState(false);

    const suggestions = useMemo(() => {
        return getPlannedCards()
            .filter(c => {
                if (c.completed || c.myDay) return false;
                if (!c.dueDate) return false;
                const d = new Date(c.dueDate);
                return isToday(d) || isTomorrow(d);
            })
            .slice(0, 8);
    }, [getPlannedCards]);

    if (suggestions.length === 0) return null;

    const addToMyDay = (card, category = 'essential') => {
        collabDispatch({
            type: 'UPDATE_CARD',
            payload: {
                boardId: card.boardId,
                listId: card.listId,
                cardId: card.id,
                updates: { myDay: true, dayCategory: category },
            },
        });
    };

    return (
        <DiaryGlassCard className="diary-suggestions-card">
            <button
                type="button"
                className="diary-suggestions-toggle"
                onClick={() => setOpen(v => !v)}
                aria-expanded={open}
            >
                <Sparkles size={16} />
                <span className="diary-suggestions-toggle-text">
                    Sugestões para hoje
                    <span className="diary-suggestions-count">{suggestions.length}</span>
                </span>
                <ChevronDown size={16} className={`diary-suggestions-chevron ${open ? 'open' : ''}`} />
            </button>

            {open && (
                <ul className="diary-suggestions-list">
                    {suggestions.map(card => {
                        const d = new Date(card.dueDate);
                        const when = isToday(d) ? 'Hoje' : isTomorrow(d) ? 'Amanhã' : format(d, 'dd MMM', { locale: ptBR });
                        return (
                            <li key={card.id} className="diary-suggestion-item">
                                <button
                                    type="button"
                                    className="diary-suggestion-main"
                                    onClick={() => onCardClick?.(card, card.boardId, card.listId)}
                                >
                                    <span className="diary-suggestion-title">{card.title}</span>
                                    <span className="diary-suggestion-meta">
                                        {card.boardTitle} · {when}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    className="diary-suggestion-add"
                                    title="Adicionar ao Meu Dia"
                                    onClick={() => addToMyDay(card)}
                                >
                                    <Plus size={16} />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </DiaryGlassCard>
    );
}
