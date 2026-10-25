import { useMemo, useState } from 'react';
import { addDays, format, isSameDay, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRight, CalendarDays, Check, ChevronDown, Circle, Layers, Shapes, Sun } from 'lucide-react';
import { useApp } from '../../context/useApp';
import { useAuth } from '../../context/useAuth';
import { useSmartViewCardCompletion } from '../../hooks/useSmartViewCardCompletion';
import { getCardTemporalBucket, parseCardDate } from '../../utils/cardDateTime';
import { isCardActive } from '../../utils/cardSmartView';
import './Dashboard.css';

const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 };
const PRIORITIES = [
    { id: 'urgent', label: 'Urgente' },
    { id: 'high', label: 'Alta' },
    { id: 'medium', label: 'Média' },
    { id: 'low', label: 'Baixa' },
];
const FOCUS_LIMIT = 6;

function greetingFor(date) {
    const h = date.getHours();
    if (h >= 5 && h < 12) return 'Bom dia';
    if (h >= 12 && h < 18) return 'Boa tarde';
    return 'Boa noite';
}

function navigate(view) {
    window.dispatchEvent(new CustomEvent('app-navigate-view', { detail: { view } }));
}

function plural(n, one, many) {
    return `${n} ${n === 1 ? one : many}`;
}

/** Linha de tarefa com concluir no lugar: o círculo conclui, o resto abre o card. */
function FocusRow({ card, onOpen, onComplete, showDate }) {
    const [leaving, setLeaving] = useState(false);
    const bucket = getCardTemporalBucket(card);
    const due = parseCardDate(card.dueDate);

    const complete = (e) => {
        e.stopPropagation();
        setLeaving(true);
        // a linha sai animada; a conclusão vai junto (o estado global tira o card da lista)
        onComplete(card);
    };

    return (
        <li className={`home-task ${leaving ? 'is-leaving' : ''}`} data-priority={card.priority || 'none'}>
            <button type="button" className="home-task-check" onClick={complete} aria-label={`Concluir "${card.title}"`}>
                <Circle size={18} className="home-task-check-ring" aria-hidden />
                <Check size={12} className="home-task-check-mark" aria-hidden />
            </button>
            <button type="button" className="home-task-main" onClick={() => onOpen(card)}>
                <span className="home-task-title">{card.title || 'Sem título'}</span>
                <span className="home-task-meta">
                    <span className="home-task-where">{card.boardEmoji} {card.boardTitle}</span>
                    {bucket === 'overdue' && <span className="home-chip is-danger">Atrasada</span>}
                    {showDate && due && bucket !== 'overdue' && (
                        <span className="home-chip">{format(due, "dd 'de' MMM", { locale: ptBR })}</span>
                    )}
                    {card.priority && card.priority !== 'none' && (
                        <span className="home-prio" aria-label={`Prioridade ${card.priority}`} />
                    )}
                </span>
            </button>
        </li>
    );
}

export default function DashboardView({ onCardClick }) {
    const { state, getAllCards, dispatch } = useApp();
    const { user } = useAuth();
    const { toggleCardCompletion } = useSmartViewCardCompletion();
    const [dayOffset, setDayOffset] = useState(0);
    const [showAllFocus, setShowAllFocus] = useState(false);

    const now = new Date();
    const todayKey = startOfDay(now).getTime();
    const firstName = user?.name?.split(' ')[0] || '';

    const cards = useMemo(() => getAllCards(), [getAllCards]);
    const active = useMemo(() => cards.filter(isCardActive), [cards]);

    // Poucas centenas de cards no máximo: recalcular a cada render é barato.
    const focusRank = (c) => {
        const b = getCardTemporalBucket(c);
        if (b === 'overdue') return 0;
        if (b === 'today') return 1;
        return 2;
    };
    const focus = active
        .filter((c) => c.myDay || ['overdue', 'today'].includes(getCardTemporalBucket(c)))
        .sort((a, b) => focusRank(a) - focusRank(b)
            || (PRIORITY_RANK[a.priority] ?? 4) - (PRIORITY_RANK[b.priority] ?? 4));

    const myDayAll = cards.filter((c) => c.myDay);
    const myDayDone = myDayAll.filter((c) => !isCardActive(c)).length;
    const overdueCount = focus.filter((c) => getCardTemporalBucket(c) === 'overdue').length;

    const week = Array.from({ length: 7 }, (_, i) => {
        const day = addDays(new Date(todayKey), i);
        const dayCards = active
            .filter((c) => {
                const d = parseCardDate(c.dueDate);
                return d && isSameDay(d, day);
            })
            .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 4) - (PRIORITY_RANK[b.priority] ?? 4));
        return { day, cards: dayCards };
    });
    const selectedDay = week[dayOffset];

    const boardTiles = state.boards.map((b) => {
        const all = b.lists.flatMap((l) => l.cards.map((c) => ({ c, done: c.completed || l.isCompletionList })));
        const open = all.filter((x) => !x.done);
        const urgent = open.filter((x) => x.c.priority === 'urgent' || getCardTemporalBucket(x.c) === 'overdue').length;
        return {
            id: b.id,
            title: b.title,
            emoji: b.emoji,
            color: b.color,
            open: open.length,
            pct: all.length ? Math.round(((all.length - open.length) / all.length) * 100) : 0,
            urgent,
        };
    });

    const priorityCounts = PRIORITIES.map((p) => ({
        ...p,
        count: active.filter((c) => c.priority === p.id).length,
    }));
    const maxPriority = Math.max(1, ...priorityCounts.map((p) => p.count));

    const openCard = (card) => onCardClick?.(card, card.boardId, card.listId);
    const completeCard = (card) => {
        void toggleCardCompletion(card, { id: card.boardId, title: card.boardTitle, emoji: card.boardEmoji }, { id: card.listId }, true);
    };
    const openBoard = (id) => {
        dispatch({ type: 'SET_ACTIVE_BOARD', payload: id });
        window.dispatchEvent(new CustomEvent('app-navigate-view', { detail: { view: 'board' } }));
    };

    const focusVisible = showAllFocus ? focus : focus.slice(0, FOCUS_LIMIT);
    const summary = focus.length === 0
        ? 'Nada pendente para hoje.'
        : `${plural(focus.length, 'tarefa', 'tarefas')} no foco de hoje${overdueCount ? ` · ${plural(overdueCount, 'atrasada', 'atrasadas')}` : ''}.`;

    return (
        <div className="home">
            <header className="home-hero">
                <div>
                    <p className="home-date">{format(now, "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
                    <h2 className="home-greeting">{greetingFor(now)}{firstName ? `, ${firstName}` : ''}</h2>
                    <p className="home-summary">{summary}</p>
                </div>
                {myDayAll.length > 0 && (
                    <div className="home-ring" role="img" aria-label={`Diário: ${myDayDone} de ${myDayAll.length} concluídas`}>
                        <svg viewBox="0 0 36 36" aria-hidden>
                            <circle className="home-ring-track" cx="18" cy="18" r="15.5" />
                            {myDayDone > 0 && <circle
                                className="home-ring-fill"
                                cx="18"
                                cy="18"
                                r="15.5"
                                pathLength="100"
                                style={{ strokeDasharray: `${(myDayDone / myDayAll.length) * 100} 100` }}
                            />}
                        </svg>
                        <span className="home-ring-label">
                            <strong>{myDayDone}/{myDayAll.length}</strong>
                            <span>Diário</span>
                        </span>
                    </div>
                )}
            </header>

            <div className="home-grid">
                <section className="home-card home-focus" aria-labelledby="home-focus-title">
                    <div className="home-card-head">
                        <h3 id="home-focus-title"><Sun size={16} aria-hidden /> Foco de hoje</h3>
                        <button type="button" className="home-link" onClick={() => navigate('myday')}>
                            Abrir Diário <ArrowRight size={14} aria-hidden />
                        </button>
                    </div>
                    {focus.length === 0 ? (
                        <div className="home-empty">
                            <p>Seu dia está livre.</p>
                            <p className="home-empty-hint">Arraste uma tarefa para <strong>Diário</strong> na barra lateral para trazê-la para cá.</p>
                        </div>
                    ) : (
                        <>
                            <ul className="home-task-list">
                                {focusVisible.map((c) => (
                                    <FocusRow key={c.id} card={c} onOpen={openCard} onComplete={completeCard} />
                                ))}
                            </ul>
                            {focus.length > FOCUS_LIMIT && (
                                <button type="button" className="home-more" onClick={() => setShowAllFocus((v) => !v)}>
                                    {showAllFocus ? 'Mostrar menos' : `Mais ${focus.length - FOCUS_LIMIT}`}
                                </button>
                            )}
                        </>
                    )}
                </section>

                <section className="home-card home-week" aria-labelledby="home-week-title">
                    <div className="home-card-head">
                        <h3 id="home-week-title"><CalendarDays size={16} aria-hidden /> Próximos 7 dias</h3>
                        <button type="button" className="home-link" onClick={() => navigate('planned')}>
                            Planejado <ArrowRight size={14} aria-hidden />
                        </button>
                    </div>
                    <div className="home-days" role="tablist" aria-label="Dias">
                        {week.map(({ day, cards: dc }, i) => (
                            <button
                                key={day.toISOString()}
                                type="button"
                                role="tab"
                                aria-selected={i === dayOffset}
                                className={`home-day ${i === dayOffset ? 'is-active' : ''}`}
                                onClick={() => setDayOffset(i)}
                            >
                                <span className="home-day-name">{i === 0 ? 'Hoje' : format(day, 'EEEEEE', { locale: ptBR })}</span>
                                <span className="home-day-num">{format(day, 'd')}</span>
                                <span className={`home-day-dot ${dc.length ? 'has-items' : ''}`} aria-label={plural(dc.length, 'tarefa', 'tarefas')}>
                                    {dc.length || ''}
                                </span>
                            </button>
                        ))}
                    </div>
                    {selectedDay.cards.length === 0 ? (
                        <p className="home-empty-hint home-week-empty">Nenhum prazo em {dayOffset === 0 ? 'hoje' : format(selectedDay.day, "EEEE", { locale: ptBR })}.</p>
                    ) : (
                        <ul className="home-task-list">
                            {selectedDay.cards.slice(0, 5).map((c) => (
                                <FocusRow key={c.id} card={c} onOpen={openCard} onComplete={completeCard} />
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            <section className="home-section" aria-labelledby="home-boards-title">
                <h3 id="home-boards-title" className="home-section-title"><Layers size={16} aria-hidden /> Boards</h3>
                {boardTiles.length === 0 ? (
                    <p className="home-empty-hint">Crie seu primeiro board no <strong>+</strong> ao lado de “Boards” na barra lateral.</p>
                ) : (
                    <div className="home-tiles">
                        {boardTiles.map((b) => (
                            <button
                                key={b.id}
                                type="button"
                                className="home-tile"
                                style={{ '--tile-color': typeof b.color === 'string' && !b.color.startsWith('linear') ? b.color : undefined }}
                                onClick={() => openBoard(b.id)}
                            >
                                <span className="home-tile-emoji" aria-hidden>{b.emoji}</span>
                                <span className="home-tile-title">{b.title}</span>
                                <span className="home-tile-meta">
                                    {b.open ? plural(b.open, 'aberta', 'abertas') : 'Tudo feito'}
                                    {b.urgent > 0 && <span className="home-chip is-danger">{b.urgent} pedindo atenção</span>}
                                </span>
                                <span className="home-tile-bar" aria-hidden><span style={{ width: `${b.pct}%` }} /></span>
                            </button>
                        ))}
                    </div>
                )}
            </section>

            {state.spaces?.length > 0 && (
                <section className="home-section" aria-labelledby="home-spaces-title">
                    <h3 id="home-spaces-title" className="home-section-title"><Shapes size={16} aria-hidden /> Spaces</h3>
                    <div className="home-tiles home-tiles--compact">
                        {state.spaces.map((s) => (
                            <button key={s.id} type="button" className="home-tile" onClick={() => navigate(`space-${s.id}`)}>
                                <span className="home-tile-emoji" aria-hidden>{s.emoji}</span>
                                <span className="home-tile-title">{s.title}</span>
                            </button>
                        ))}
                    </div>
                </section>
            )}

            {active.length > 0 && (
                <details className="home-card home-panorama">
                    <summary>
                        <span>Panorama das prioridades</span>
                        <ChevronDown size={16} className="home-panorama-chevron" aria-hidden />
                    </summary>
                    <ul className="home-bars">
                        {priorityCounts.map((p) => (
                            <li key={p.id} data-priority={p.id}>
                                <span className="home-bars-label">{p.label}</span>
                                <span className="home-bars-track"><span style={{ width: `${(p.count / maxPriority) * 100}%` }} /></span>
                                <span className="home-bars-count">{p.count}</span>
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </div>
    );
}
