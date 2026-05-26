import { Flame } from 'lucide-react';
import { useHeaderStreak } from '../../hooks/useHeaderStreak';
import './HeaderStreakButton.css';

export default function HeaderStreakButton({ onOpenDiary }) {
    const { todayDone, streak, loading, tooltip } = useHeaderStreak();

    return (
        <button
            type="button"
            className={`btn-icon header-icon-btn header-streak-btn${todayDone ? ' header-streak-btn--active' : ''}${loading ? ' header-streak-btn--loading' : ''}`}
            title={tooltip}
            aria-label={tooltip}
            onClick={() => onOpenDiary?.()}
        >
            <Flame
                size={18}
                fill={todayDone ? 'currentColor' : 'none'}
                strokeWidth={todayDone ? 1.5 : 2}
            />
            {streak > 0 && (
                <span className="header-streak-count" aria-hidden>
                    {streak > 99 ? '99+' : streak}
                </span>
            )}
        </button>
    );
}
