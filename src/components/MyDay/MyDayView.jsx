import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Sun, Play } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DiaryTasksColumn from './DiaryTasksColumn';
import DiaryQuickPlanner from './DiaryQuickPlanner';
import DiaryNotesPanel from './DiaryNotesPanel';
import './MyDay.css';

export default function MyDayView({ onCardClick }) {
    const { user } = useAuth();
    const { getMyDayCards } = useApp();
    const [showFocus, setShowFocus] = useState(false);

    const cards = getMyDayCards();
    const pendingCards = cards.filter(c => !c.completed);
    const completedCards = cards.filter(c => c.completed);
    const progress = cards.length > 0 ? Math.round((completedCards.length / cards.length) * 100) : 0;
    const now = new Date();
    const hour = now.getHours();

    let greeting = 'Bom dia';
    if (hour >= 12 && hour < 18) greeting = 'Boa tarde';
    if (hour >= 18) greeting = 'Boa noite';

    const todayStr = format(now, "EEEE, d 'de' MMMM", { locale: ptBR });

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

            {/* Main Content */}
            <div className="myday-content">
                <div className="diary-grid">
                    <DiaryTasksColumn onCardClick={onCardClick} />
                    <DiaryQuickPlanner onCardClick={onCardClick} />
                    <DiaryNotesPanel />
                </div>
            </div>
        </div>
    );
}
