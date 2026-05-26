import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { useSmartViewRecentCompletions } from '../../hooks/useSmartViewRecentCompletions';
import { useSmartViewCardCompletion } from '../../hooks/useSmartViewCardCompletion';

export default function SmartRecentCompletions({ onCardClick }) {
    const recent = useSmartViewRecentCompletions();
    const { toggleCardCompletion } = useSmartViewCardCompletion();

    if (!recent.length) return null;

    return (
        <section className="smart-recent-completions">
            <div className="smart-recent-completions-header">
                <CheckCircle2 size={18} />
                <h2>Concluídas recentemente</h2>
                <span className="smart-recent-completions-count">{recent.length}</span>
            </div>
            <ul className="smart-recent-completions-list">
                {recent.map((card) => (
                    <li key={`${card.boardId}-${card.id}`} className="smart-recent-completions-row">
                        <button
                            type="button"
                            className="smart-recent-completions-check"
                            title="Desmarcar conclusão"
                            aria-label="Desmarcar conclusão"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleCardCompletion(
                                    card,
                                    { id: card.boardId, title: card.boardTitle, emoji: card.boardEmoji },
                                    { id: card.listId, title: card.listTitle },
                                    false,
                                );
                            }}
                        >
                            <CheckCircle2 size={20} />
                        </button>
                        <button
                            type="button"
                            className="smart-recent-completions-item"
                            onClick={() => onCardClick?.(card, card.boardId, card.listId)}
                        >
                            <span className="smart-recent-completions-title">{card.title}</span>
                            <span className="smart-recent-completions-meta">
                                {card.boardEmoji} {card.boardTitle}
                                <ArrowRight size={10} />
                                {card.listTitle}
                                {card.completedAt ? (
                                    <>
                                        {' · '}
                                        {formatDistanceToNow(card.completedAt, {
                                            addSuffix: true,
                                            locale: ptBR,
                                        })}
                                    </>
                                ) : null}
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
        </section>
    );
}
