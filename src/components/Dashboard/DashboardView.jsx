import { useApp } from '../../context/AppContext';
import {
    LayoutDashboard, CheckCircle2, AlertCircle,
    BarChart2, Clock, Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import './Dashboard.css';

export default function DashboardView() {
    const { state, getMyDayCards } = useApp();

    // Calculate Stats
    const allCards = state.boards.flatMap(b => b.lists.flatMap(l => l.cards));
    const totalTasks = allCards.length;
    const completedTasks = allCards.filter(c => c.completed).length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const urgentCount = allCards.filter(c => c.priority === 'urgent' && !c.completed).length;
    const highCount = allCards.filter(c => c.priority === 'high' && !c.completed).length;

    const myDayCount = getMyDayCards().length;
    const myDayCompleted = getMyDayCards().filter(c => c.completed).length;

    const recentlyCompleted = allCards
        .filter(c => c.completed)
        .slice(0, 5); // In a real app, sort by completion date if available

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
                                className="progress-ring-circle"
                                stroke="var(--accent-primary)"
                                strokeWidth="8"
                                fill="transparent"
                                r="52"
                                cx="60"
                                cy="60"
                                style={{
                                    strokeDasharray: `${2 * Math.PI * 52} ${2 * Math.PI * 52}`,
                                    strokeDashoffset: (2 * Math.PI * 52) - ((completionRate / 100) * (2 * Math.PI * 52))
                                }}
                            />
                        </svg>
                        <div className="progress-value">
                            <span className="progress-number">{completionRate}%</span>
                            <span className="progress-label">Concluído</span>
                        </div>
                    </div>
                    <div className="stat-footer">
                        <span>{completedTasks} de {totalTasks} tarefas</span>
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
