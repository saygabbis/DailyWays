import { useRef, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
    LayoutDashboard, CheckCircle2, AlertCircle,
    BarChart2, Clock, Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import './Dashboard.css';

const CIRCLE_R = 52;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_R;

export default function DashboardView() {
    const { state, getMyDayCards } = useApp();
    const [animatedRate, setAnimatedRate] = useState(0);
    const hasAnimated = useRef(false);

    // Progresso por SUBTAREFAS: total = todas as subtasks, concluídas = com done: true
    const allSubtasks = state.boards.flatMap(b =>
        b.lists.flatMap(l =>
            l.cards.flatMap(c => (c.subtasks || []).map(st => ({ ...st, _card: c, _list: l })))
        )
    );
    const totalSubtasks = allSubtasks.length;
    const completedSubtasks = allSubtasks.filter(st => st.done).length;
    const completionRate = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

    // Animação do anel ao entrar na tela
    useEffect(() => {
        if (hasAnimated.current) {
            setAnimatedRate(completionRate);
            return;
        }
        hasAnimated.current = true;
        setAnimatedRate(0);
        const t = setTimeout(() => {
            setAnimatedRate(completionRate);
        }, 100);
        return () => clearTimeout(t);
    }, [completionRate]);

    // Card "concluído" para contagens: está em uma lista marcada como lista de conclusão
    const allCardsWithList = state.boards.flatMap(b =>
        b.lists.flatMap(l => l.cards.map(c => ({ ...c, _list: l })))
    );
    const isCardInCompletionList = (c) => c._list?.isCompletionList === true;

    const urgentCount = allCardsWithList.filter(c => c.priority === 'urgent' && !isCardInCompletionList(c)).length;
    const highCount = allCardsWithList.filter(c => c.priority === 'high' && !isCardInCompletionList(c)).length;

    const myDayCount = getMyDayCards().length;
    const myDayCompleted = getMyDayCards().filter(c => c.completed).length;

    // Recém concluídos: apenas cards que estão em listas de conclusão
    const recentlyCompleted = allCardsWithList
        .filter(isCardInCompletionList)
        .slice(0, 5);

    return (
        <div className="dashboard-view animate-fade-in">
            {/* Hero */}
            <div className="dashboard-hero">
                <div className="dashboard-hero-content">
                    <h1>Visão Geral</h1>
                    <p>Acompanhe seu progresso e estatísticas</p>
                </div>
                <div className="dashboard-hero-icon">
                    <LayoutDashboard size={48} strokeWidth={1.5} />
                </div>
            </div>

            {/* Stats Grid */}
            <div className="dashboard-grid">
                {/* Main Progress */}
                <div className="stat-card stat-progress">
                    <div className="stat-header">
                        <span className="stat-title">Progresso Total</span>
                        <BarChart2 size={16} />
                    </div>
                    <div className="progress-ring-container">
                        <svg className="progress-ring" width="120" height="120">
                            <circle
                                className="progress-ring-circle-bg"
                                stroke="var(--border-color)"
                                strokeWidth="8"
                                fill="transparent"
                                r="52"
                                cx="60"
                                cy="60"
                            />
                            <circle
                                className="progress-ring-circle progress-ring-circle-animated"
                                stroke="var(--accent-primary)"
                                strokeWidth="8"
                                fill="transparent"
                                r={CIRCLE_R}
                                cx="60"
                                cy="60"
                                style={{
                                    strokeDasharray: `${CIRCLE_CIRCUMFERENCE} ${CIRCLE_CIRCUMFERENCE}`,
                                    strokeDashoffset: CIRCLE_CIRCUMFERENCE - (animatedRate / 100) * CIRCLE_CIRCUMFERENCE
                                }}
                            />
                        </svg>
                        <div className="progress-value">
                            <span className="progress-number">{completionRate}%</span>
                            <span className="progress-label">Concluído</span>
                        </div>
                    </div>
                    <div className="stat-footer">
                        <span>{completedSubtasks} de {totalSubtasks} subtarefas</span>
                    </div>
                </div>

                {/* Counts */}
                <div className="dashboard-column">
                    <div className="stat-card stat-highlight">
                        <div className="stat-icon-bg" style={{ background: 'var(--priority-urgent)' }}>
                            <AlertCircle size={24} color="white" />
                        </div>
                        <div className="stat-info">
                            <span className="stat-value">{urgentCount}</span>
                            <span className="stat-label">Urgentes</span>
                        </div>
                    </div>
                    <div className="stat-card stat-highlight">
                        <div className="stat-icon-bg" style={{ background: 'var(--priority-high)' }}>
                            <AlertCircle size={24} color="white" />
                        </div>
                        <div className="stat-info">
                            <span className="stat-value">{highCount}</span>
                            <span className="stat-label">Alta Prioridade</span>
                        </div>
                    </div>
                    <div className="stat-card stat-highlight">
                        <div className="stat-icon-bg" style={{ background: 'var(--accent-primary)' }}>
                            <Clock size={24} color="white" />
                        </div>
                        <div className="stat-info">
                            <span className="stat-value">{myDayCompleted}/{myDayCount}</span>
                            <span className="stat-label">Meu Dia</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recents */}
            <div className="dashboard-section">
                <h3 className="section-title"><CheckCircle2 size={16} /> Recém Concluídos</h3>
                <div className="recent-list">
                    {recentlyCompleted.length === 0 ? (
                        <div className="empty-recents">Nenhuma tarefa concluída recentemente</div>
                    ) : (
                        recentlyCompleted.map(card => (
                            <div key={card.id} className="recent-item">
                                <CheckCircle2 size={16} className="recent-check" />
                                <span className="recent-title">{card.title}</span>
                                <span className="recent-date">
                                    {card.dueDate ? format(new Date(card.dueDate), 'dd/MM', { locale: ptBR }) : ''}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
