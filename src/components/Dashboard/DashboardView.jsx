import { useRef, useEffect, useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
    LayoutDashboard, CheckCircle2, AlertCircle,
    BarChart2, Calendar, ChevronDown, ChevronUp,
    Tag, Layers, ListChecks, TrendingUp, Star, Zap,
    Target, AlertTriangle, Flag, Inbox, Repeat, Link2
} from 'lucide-react';
import { format, isTomorrow, isThisWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getCardTemporalBucket, parseCardDate } from '../../utils/cardDateTime';
import './Dashboard.css';

const CIRCLE_R = 44;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_R;
const TITLE_CLAMP = 55;

function ExpandableSection({
    title, icon, children, summary, badge = null,
    defaultOpen = false, accentColor = null, id,
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <section
            id={id}
            className={`dash-panel ${open ? 'dash-panel--open' : ''}`}
            style={accentColor ? { '--panel-accent': accentColor } : undefined}
        >
            <button type="button" className="dash-panel__header" onClick={() => setOpen(o => !o)}>
                <div className="dash-panel__header-main">
                    <span className="dash-panel__icon">{icon}</span>
                    <div className="dash-panel__titles">
                        <span className="dash-panel__title">{title}</span>
                        {!open && summary && (
                            <span className="dash-panel__summary">{summary}</span>
                        )}
                    </div>
                </div>
                <div className="dash-panel__header-actions">
                    {badge !== null && <span className="dash-panel__badge">{badge}</span>}
                    <span className="dash-panel__toggle">
                        {open ? 'Recolher' : 'Expandir'}
                        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </span>
                </div>
            </button>
            {open && <div className="dash-panel__body">{children}</div>}
        </section>
    );
}

function MiniProgress({ value, color }) {
    return (
        <div className="mini-progress">
            <div
                className="mini-progress-bar"
                style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color || 'var(--accent-primary)' }}
            />
        </div>
    );
}

function PriorityDot({ priority }) {
    const colors = { urgent: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' };
    return <span className="priority-dot" style={{ background: colors[priority] || 'var(--text-tertiary)' }} />;
}

function TaskItem({ card, showDate = false, showBoard = false, showList = true }) {
    const [expanded, setExpanded] = useState(false);
    const title = card.title || 'Sem título';
    const isLong = title.length > TITLE_CLAMP;

    return (
        <article className="task-item">
            <div className="task-item__row">
                <PriorityDot priority={card.priority} />
                <div className="task-item__body">
                    <p className={`task-item__title ${!expanded && isLong ? 'is-clamped' : ''}`}>{title}</p>
                    <div className="task-item__meta">
                        {showBoard && card._board && (
                            <span className="task-item__chip">{card._board.emoji} {card._board.title}</span>
                        )}
                        {showList && card._list && (
                            <span className="task-item__chip task-item__chip--muted">{card._list.title}</span>
                        )}
                        {showDate && card.dueDate && (
                            <span className={`task-item__chip ${getCardTemporalBucket(card) === 'overdue' ? 'task-item__chip--danger' : ''}`}>
                                {format(new Date(card.dueDate), 'dd/MM', { locale: ptBR })}
                            </span>
                        )}
                    </div>
                </div>
                {isLong && (
                    <button
                        type="button"
                        className="task-item__expand-btn"
                        onClick={() => setExpanded(e => !e)}
                        aria-label={expanded ? 'Recolher título' : 'Ver título completo'}
                    >
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                )}
            </div>
        </article>
    );
}

function TaskList({ cards, emptyText, limit = 5, showAllLabel, ...itemProps }) {
    const [showAll, setShowAll] = useState(false);
    if (!cards.length) return <p className="dash-empty">{emptyText}</p>;
    const visible = showAll ? cards : cards.slice(0, limit);
    return (
        <div className="task-list">
            {visible.map(c => <TaskItem key={c.id} card={c} {...itemProps} />)}
            {cards.length > limit && (
                <button type="button" className="task-list__more" onClick={() => setShowAll(s => !s)}>
                    {showAll ? 'Mostrar menos' : (showAllLabel || `Ver todas (${cards.length})`)}
                </button>
            )}
        </div>
    );
}

export default function DashboardView() {
    const { state, getMyDayCards, getMyDayCardsAll } = useApp();
    const [animatedRate, setAnimatedRate] = useState(0);
    const hasAnimated = useRef(false);

    const allCardsWithMeta = useMemo(() => state.boards.flatMap(b =>
        b.lists.flatMap(l => l.cards.map(c => ({ ...c, _list: l, _board: b })))
    ), [state.boards]);

    const isCompleted = c => c._list?.isCompletionList === true;
    const activeCards = allCardsWithMeta.filter(c => !isCompleted(c));
    const completedCards = allCardsWithMeta.filter(isCompleted);

    const allSubtasks = useMemo(() => state.boards.flatMap(b =>
        b.lists.flatMap(l =>
            l.cards.flatMap(c => (c.subtasks || []).map(st => ({ ...st, _card: c, _list: l, _board: b })))
        )
    ), [state.boards]);
    const totalSubtasks = allSubtasks.length;
    const completedSubtasks = allSubtasks.filter(st => st.done).length;
    const completionRate = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

    const urgentCards = activeCards.filter(c => c.priority === 'urgent');
    const highCards = activeCards.filter(c => c.priority === 'high');
    const mediumCards = activeCards.filter(c => c.priority === 'medium');
    const lowCards = activeCards.filter(c => c.priority === 'low');
    const noPriorityCards = activeCards.filter(c => !c.priority);

    const overdueCards = activeCards.filter(c => getCardTemporalBucket(c) === 'overdue');
    const todayCards = activeCards.filter(c => getCardTemporalBucket(c) === 'today');
    const tomorrowCards = activeCards.filter(c => {
        const d = parseCardDate(c.dueDate);
        return d && isTomorrow(d);
    });
    const thisWeekCards = activeCards.filter(c => {
        const d = parseCardDate(c.dueDate);
        return d && isThisWeek(d, { weekStartsOn: 1 }) && getCardTemporalBucket(c) !== 'today' && !isTomorrow(d);
    });
    const plannedCards = activeCards.filter(c => parseCardDate(c.dueDate));
    const noDueDateCards = activeCards.filter(c => !parseCardDate(c.dueDate));

    const myDayPending = getMyDayCards();
    const myDayAll = getMyDayCardsAll();
    const myDayCompleted = myDayAll.filter(c => isCompleted(c)).length;
    const myDayRate = myDayAll.length > 0 ? Math.round((myDayCompleted / myDayAll.length) * 100) : 0;

    const boardStats = useMemo(() => state.boards.map(b => {
        const bCards = b.lists.flatMap(l => l.cards.map(c => ({ ...c, _list: l })));
        const bActive = bCards.filter(c => !c._list?.isCompletionList);
        const bDone = bCards.filter(c => c._list?.isCompletionList);
        const bSubtasks = bCards.flatMap(c => c.subtasks || []);
        const bSubDone = bSubtasks.filter(s => s.done);
        const pct = bSubtasks.length > 0 ? Math.round((bSubDone.length / bSubtasks.length) * 100) : 0;
        return {
            id: b.id, title: b.title, emoji: b.emoji, color: b.color,
            activeCards: bActive.length, completedCards: bDone.length,
            totalLists: b.lists.length, subtaskPct: pct,
            urgentCount: bActive.filter(c => c.priority === 'urgent').length,
        };
    }), [state.boards]);

    const labelStats = useMemo(() => {
        const map = {};
        activeCards.forEach(c => (c.labels || []).forEach(lId => {
            if (!map[lId]) map[lId] = { id: lId, count: 0 };
            map[lId].count++;
        }));
        return Object.values(map).sort((a, b) => b.count - a.count);
    }, [activeCards]);

    const labelColors = useMemo(() => {
        const m = {};
        (state.labels || []).forEach(l => { m[l.id] = l; });
        return m;
    }, [state.labels]);

    const recentlyCompleted = completedCards.slice(0, 10);
    const recentlyAdded = [...activeCards]
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 10);

    const recurringCards = activeCards.filter(c => c.recurrenceRule);
    const cardsWithSubtaskLinks = allSubtasks.filter(s => s.linkUrl);
    const cardsWithSubtasks = activeCards.filter(c => (c.subtasks || []).length > 0);

    const criticalCount = urgentCards.length + overdueCards.length;

    useEffect(() => {
        if (hasAnimated.current) { setAnimatedRate(completionRate); return; }
        hasAnimated.current = true;
        setAnimatedRate(0);
        const t = setTimeout(() => setAnimatedRate(completionRate), 100);
        return () => clearTimeout(t);
    }, [completionRate]);

    const now = new Date();

    return (
        <div className="dashboard-view animate-slide-up">

            {/* Cabeçalho compacto */}
            <header className="dash-header">
                <div className="dash-header__left">
                    <LayoutDashboard size={22} className="dash-header__icon" />
                    <div>
                        <h1>Visão Geral</h1>
                        <p>{format(now, "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
                    </div>
                </div>
                <div className="dash-header__stats">
                    <div className="dash-header__stat">
                        <strong>{activeCards.length}</strong>
                        <span>ativas</span>
                    </div>
                    <div className="dash-header__stat">
                        <strong>{completedCards.length}</strong>
                        <span>concluídas</span>
                    </div>
                    <div className="dash-header__stat">
                        <strong>{state.boards.length}</strong>
                        <span>boards</span>
                    </div>
                    <div className="dash-header__stat dash-header__stat--accent">
                        <strong>{completionRate}%</strong>
                        <span>progresso</span>
                    </div>
                </div>
            </header>

            {/* Métricas principais — 6 itens, grid uniforme */}
            <div className="dash-metrics">
                <MetricCard icon={<Zap size={16} />} label="Urgentes" value={urgentCards.length} tone="danger" />
                <MetricCard icon={<AlertTriangle size={16} />} label="Atrasadas" value={overdueCards.length} tone="warning" />
                <MetricCard icon={<Target size={16} />} label="Hoje" value={todayCards.length} tone="success" />
                <MetricCard icon={<Star size={16} />} label="Meu Dia" value={myDayPending.length} tone="accent" />
                <MetricCard icon={<Calendar size={16} />} label="Planejadas" value={plannedCards.length} />
                <MetricCard icon={<ListChecks size={16} />} label="Subtarefas" value={`${completedSubtasks}/${totalSubtasks}`} />
            </div>

            {/* Resumo em 3 colunas iguais */}
            <div className="dash-summary-row">
                <div className="dash-summary-card">
                    <div className="dash-summary-card__head">
                        <BarChart2 size={16} />
                        <span>Progresso geral</span>
                    </div>
                    <div className="dash-summary-card__progress">
                        <div className="progress-ring-wrap">
                            <svg className="progress-ring" width="100" height="100" viewBox="0 0 100 100">
                                <circle stroke="var(--border-color)" strokeWidth="8" fill="transparent"
                                    r={CIRCLE_R} cx="50" cy="50" />
                                <circle className="progress-ring-fill" stroke="var(--accent-primary)"
                                    strokeWidth="8" fill="transparent" r={CIRCLE_R} cx="50" cy="50"
                                    style={{
                                        strokeDasharray: CIRCLE_CIRCUMFERENCE,
                                        strokeDashoffset: CIRCLE_CIRCUMFERENCE - (animatedRate / 100) * CIRCLE_CIRCUMFERENCE,
                                    }} />
                            </svg>
                            <span className="progress-ring-label">{completionRate}%</span>
                        </div>
                        <ul className="dash-stat-list">
                            <li><span>Subtarefas</span><strong>{completedSubtasks}/{totalSubtasks}</strong></li>
                            <li><span>Total tarefas</span><strong>{allCardsWithMeta.length}</strong></li>
                        </ul>
                    </div>
                </div>

                <div className="dash-summary-card">
                    <div className="dash-summary-card__head">
                        <Star size={16} />
                        <span>Meu Dia</span>
                        <strong className="dash-summary-card__pct">{myDayRate}%</strong>
                    </div>
                    <MiniProgress value={myDayRate} color="#f59e0b" />
                    <p className="dash-summary-card__sub">{myDayCompleted} de {myDayAll.length} concluídas</p>
                    {myDayPending.length === 0 ? (
                        <p className="dash-empty dash-empty--inline">Nada pendente hoje</p>
                    ) : (
                        <div className="task-list task-list--compact">
                            {myDayPending.slice(0, 4).map(c => (
                                <TaskItem key={c.id} card={c} showList={false} showDate />
                            ))}
                        </div>
                    )}
                </div>

                <div className="dash-summary-card">
                    <div className="dash-summary-card__head">
                        <Calendar size={16} />
                        <span>Agenda rápida</span>
                    </div>
                    <div className="agenda-pills">
                        <AgendaPill label="Hoje" count={todayCards.length} />
                        <AgendaPill label="Amanhã" count={tomorrowCards.length} />
                        <AgendaPill label="Semana" count={thisWeekCards.length} />
                        <AgendaPill label="Sem prazo" count={noDueDateCards.length} muted />
                    </div>
                    {overdueCards.length > 0 && (
                        <p className="dash-alert">
                            <AlertTriangle size={13} />
                            {overdueCards.length} atrasada{overdueCards.length > 1 ? 's' : ''}
                        </p>
                    )}
                </div>
            </div>

            {/* Painéis — grid 2 colunas, todos recolhidos por padrão */}
            <div className="dash-panels">

                <ExpandableSection
                    id="dash-urgent"
                    title="Urgentes e atrasadas"
                    icon={<AlertCircle size={16} />}
                    badge={criticalCount}
                    accentColor="#ef4444"
                    defaultOpen={criticalCount > 0 && criticalCount <= 5}
                    summary={`${urgentCards.length} urgentes · ${overdueCards.length} atrasadas`}
                >
                    {criticalCount === 0 ? (
                        <p className="dash-empty">Nenhuma tarefa crítica no momento</p>
                    ) : (
                        <>
                            {urgentCards.length > 0 && (
                                <div className="dash-subsection">
                                    <h4 className="dash-subsection__title">
                                        <Zap size={12} /> Urgentes
                                    </h4>
                                    <TaskList cards={urgentCards} emptyText="" showBoard showList />
                                </div>
                            )}
                            {overdueCards.length > 0 && (
                                <div className="dash-subsection">
                                    <h4 className="dash-subsection__title">
                                        <AlertTriangle size={12} /> Atrasadas
                                    </h4>
                                    <TaskList cards={overdueCards} emptyText="" showBoard showDate />
                                </div>
                            )}
                        </>
                    )}
                </ExpandableSection>

                <ExpandableSection
                    title="Agenda detalhada"
                    icon={<Calendar size={16} />}
                    badge={plannedCards.length}
                    accentColor="#06b6d4"
                    summary={`Hoje ${todayCards.length} · Amanhã ${tomorrowCards.length} · Semana ${thisWeekCards.length}`}
                >
                    <div className="agenda-columns">
                        <AgendaColumn title="Hoje" cards={todayCards} />
                        <AgendaColumn title="Amanhã" cards={tomorrowCards} />
                        <AgendaColumn title="Esta semana" cards={thisWeekCards} />
                    </div>
                </ExpandableSection>

                <ExpandableSection
                    title="Prioridades"
                    icon={<Flag size={16} />}
                    badge={activeCards.length}
                    accentColor="#f97316"
                    summary={`${urgentCards.length} urg · ${highCards.length} alta · ${mediumCards.length} méd`}
                >
                    <div className="priority-chart">
                        <PriorityRow label="Urgente" count={urgentCards.length} total={activeCards.length} color="#ef4444" cards={urgentCards} />
                        <PriorityRow label="Alta" count={highCards.length} total={activeCards.length} color="#f97316" cards={highCards} />
                        <PriorityRow label="Média" count={mediumCards.length} total={activeCards.length} color="#eab308" cards={mediumCards} />
                        <PriorityRow label="Baixa" count={lowCards.length} total={activeCards.length} color="#22c55e" cards={lowCards} />
                        <PriorityRow label="Sem prioridade" count={noPriorityCards.length} total={activeCards.length} color="var(--text-tertiary)" cards={noPriorityCards} />
                    </div>
                </ExpandableSection>

                <ExpandableSection
                    title="Boards"
                    icon={<Layers size={16} />}
                    badge={state.boards.length}
                    summary={boardStats.map(b => `${b.emoji} ${b.activeCards}`).join(' · ') || 'Nenhum board'}
                >
                    <div className="board-list">
                        {boardStats.map(b => (
                            <div key={b.id} className="board-item">
                                <div className="board-item__accent" style={{
                                    background: typeof b.color === 'string' && b.color.startsWith('linear')
                                        ? b.color : (b.color || 'var(--border-color)'),
                                }} />
                                <div className="board-item__content">
                                    <div className="board-item__top">
                                        <span>{b.emoji} {b.title}</span>
                                        {b.urgentCount > 0 && (
                                            <span className="board-item__badge">{b.urgentCount} urg.</span>
                                        )}
                                    </div>
                                    <p className="board-item__meta">
                                        {b.totalLists} listas · {b.activeCards} ativas · {b.completedCards} concluídas
                                    </p>
                                    <MiniProgress value={b.subtaskPct} />
                                </div>
                            </div>
                        ))}
                    </div>
                </ExpandableSection>

                <ExpandableSection
                    title="Etiquetas"
                    icon={<Tag size={16} />}
                    badge={labelStats.length}
                    accentColor="#8b5cf6"
                    summary={labelStats.length ? `${labelStats.length} em uso` : 'Nenhuma em uso'}
                >
                    {labelStats.length === 0 ? (
                        <p className="dash-empty">Nenhuma etiqueta nas tarefas ativas</p>
                    ) : (
                        <div className="label-grid">
                            {labelStats.map(ls => {
                                const info = labelColors[ls.id];
                                const pct = activeCards.length ? Math.round((ls.count / activeCards.length) * 100) : 0;
                                return (
                                    <div key={ls.id} className="label-item">
                                        <span className="label-item__dot" style={{ background: info?.color || '#888' }} />
                                        <span className="label-item__name">{info?.name || ls.id}</span>
                                        <span className="label-item__count">{ls.count}</span>
                                        <MiniProgress value={pct} color={info?.color} />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </ExpandableSection>

                <ExpandableSection
                    title="Recém adicionadas"
                    icon={<Inbox size={16} />}
                    badge={recentlyAdded.length}
                    summary={recentlyAdded[0]?.title?.slice(0, 40) || 'Vazio'}
                >
                    <TaskList cards={recentlyAdded} emptyText="Nenhuma tarefa recente" showBoard showDate />
                </ExpandableSection>

                <ExpandableSection
                    title="Recém concluídas"
                    icon={<CheckCircle2 size={16} />}
                    badge={completedCards.length}
                    accentColor="var(--success)"
                    summary={`${completedCards.length} no total`}
                >
                    {recentlyCompleted.length === 0 ? (
                        <p className="dash-empty">Nenhuma concluída ainda</p>
                    ) : (
                        <div className="task-list">
                            {recentlyCompleted.map(c => (
                                <article key={c.id} className="task-item task-item--done">
                                    <CheckCircle2 size={14} className="task-item__done-icon" />
                                    <div className="task-item__body">
                                        <p className="task-item__title is-clamped">{c.title}</p>
                                        <span className="task-item__chip">{c._board?.emoji} {c._board?.title}</span>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </ExpandableSection>

                <ExpandableSection
                    title="Subtarefas por tarefa"
                    icon={<ListChecks size={16} />}
                    badge={totalSubtasks}
                    summary={`${completedSubtasks} de ${totalSubtasks} feitas`}
                >
                    {cardsWithSubtasks.length === 0 ? (
                        <p className="dash-empty">Nenhuma subtarefa</p>
                    ) : (
                        <div className="subtask-grid">
                            {cardsWithSubtasks
                                .sort((a, b) => (b.subtasks?.length || 0) - (a.subtasks?.length || 0))
                                .slice(0, 10)
                                .map(c => {
                                    const done = (c.subtasks || []).filter(s => s.done).length;
                                    const total = (c.subtasks || []).length;
                                    const pct = total ? Math.round((done / total) * 100) : 0;
                                    return (
                                        <div key={c.id} className="subtask-item">
                                            <div className="subtask-item__top">
                                                <PriorityDot priority={c.priority} />
                                                <span className="subtask-item__title is-clamped">{c.title}</span>
                                                <span className="subtask-item__count">{done}/{total}</span>
                                            </div>
                                            <MiniProgress value={pct} />
                                        </div>
                                    );
                                })}
                        </div>
                    )}
                </ExpandableSection>

                {recurringCards.length > 0 && (
                    <ExpandableSection
                        title="Recorrentes"
                        icon={<Repeat size={16} />}
                        badge={recurringCards.length}
                        summary={`${recurringCards.length} tarefa${recurringCards.length > 1 ? 's' : ''}`}
                    >
                        <TaskList cards={recurringCards} emptyText="" showBoard />
                    </ExpandableSection>
                )}

                {cardsWithSubtaskLinks.length > 0 && (
                    <ExpandableSection
                        title="Links em subtarefas"
                        icon={<Link2 size={16} />}
                        badge={cardsWithSubtaskLinks.length}
                        summary={`${cardsWithSubtaskLinks.length} link${cardsWithSubtaskLinks.length > 1 ? 's' : ''}`}
                    >
                        <ul className="link-list">
                            {cardsWithSubtaskLinks.slice(0, 12).map(s => (
                                <li key={s.id} className="link-list__item">
                                    <a href={s.linkUrl} target="_blank" rel="noopener noreferrer">
                                        {s.linkLabel || s.linkUrl}
                                    </a>
                                    <span>{s._card?.title}</span>
                                </li>
                            ))}
                        </ul>
                    </ExpandableSection>
                )}
            </div>
        </div>
    );
}

function MetricCard({ icon, label, value, tone }) {
    return (
        <div className={`metric-card ${tone ? `metric-card--${tone}` : ''}`}>
            <span className="metric-card__icon">{icon}</span>
            <span className="metric-card__value">{value}</span>
            <span className="metric-card__label">{label}</span>
        </div>
    );
}

function AgendaPill({ label, count, muted }) {
    return (
        <div className={`agenda-pill ${muted ? 'agenda-pill--muted' : ''} ${count > 0 ? 'agenda-pill--active' : ''}`}>
            <span className="agenda-pill__count">{count}</span>
            <span className="agenda-pill__label">{label}</span>
        </div>
    );
}

function AgendaColumn({ title, cards }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="agenda-col">
            <button
                type="button"
                className="agenda-col__head"
                onClick={() => cards.length > 0 && setOpen(o => !o)}
                disabled={!cards.length}
            >
                <span>{title}</span>
                <span className="agenda-col__count">{cards.length}</span>
                {cards.length > 0 && (
                    open ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                )}
            </button>
            {open && (
                <div className="agenda-col__body">
                    <TaskList cards={cards} emptyText="Nenhuma" limit={8} showBoard />
                </div>
            )}
        </div>
    );
}

function PriorityRow({ label, count, total, color, cards }) {
    const [open, setOpen] = useState(false);
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
        <div className="priority-row">
            <button
                type="button"
                className="priority-row__head"
                onClick={() => count > 0 && setOpen(o => !o)}
                disabled={!count}
            >
                <span className="priority-row__dot" style={{ background: color }} />
                <span className="priority-row__label">{label}</span>
                <div className="priority-row__bar">
                    <div className="priority-row__fill" style={{ width: `${pct}%`, background: color }} />
                </div>
                <span className="priority-row__count">{count}</span>
                {count > 0 && (open ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
            </button>
            {open && (
                <div className="priority-row__body">
                    <TaskList cards={cards} emptyText="" limit={6} showBoard showDate />
                </div>
            )}
        </div>
    );
}
