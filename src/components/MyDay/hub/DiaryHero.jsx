import { CheckCircle2, Clock, Flame } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import DiaryStatChip from './DiaryStatChip';
import DiaryStreakBadge from './DiaryStreakBadge';

function getGreeting(hour) {
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    if (hour >= 18) return 'Boa noite';
    return 'Bom dia';
}

export default function DiaryHero({
    motivationalPhrase,
    completedToday,
    totalToday,
    focusDisplay,
    streak,
}) {
    const { user } = useAuth();
    const hour = new Date().getHours();
    const greeting = getGreeting(hour);
    const firstName = user?.name?.split(' ')[0] || 'você';

    return (
        <header className="diary-hero">
            <div className="diary-hero-text">
                <h1 className="diary-hero-greeting">
                    {greeting}, <span className="diary-hero-name">{firstName}</span> ✨
                </h1>
                <p className="diary-hero-subtitle">{motivationalPhrase}</p>
            </div>

            <div className="diary-hero-chips">
                <DiaryStatChip
                    icon={CheckCircle2}
                    value={completedToday}
                    label="concluídas hoje"
                    hint={totalToday > 0 ? `de ${totalToday} missões` : undefined}
                />
                <DiaryStatChip
                    icon={Clock}
                    value={focusDisplay}
                    label="tempo focado"
                />
                <DiaryStatChip
                    icon={Flame}
                    value={streak}
                    label="dias avançando"
                />
            </div>

            {streak > 0 && <DiaryStreakBadge streak={streak} />}
        </header>
    );
}
