import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    computeStreak,
    dayQualifiesForStreak,
    fetchTodayProgress,
} from '../services/dailyProgressService';
import { TIMEZONE_FALLBACK } from '../components/MyDay/hub/diaryHubConfig';

export function useHeaderStreak() {
    const { user } = useAuth();
    const [streak, setStreak] = useState(0);
    const [todayDone, setTodayDone] = useState(false);
    const [loading, setLoading] = useState(true);

    const timezone = user?.timezone || TIMEZONE_FALLBACK;

    const refresh = useCallback(async () => {
        if (!user?.id) {
            setStreak(0);
            setTodayDone(false);
            setLoading(false);
            return;
        }
        const [{ data: today }, streakCount] = await Promise.all([
            fetchTodayProgress(user.id, timezone),
            computeStreak(user.id, timezone),
        ]);
        setTodayDone(dayQualifiesForStreak(today));
        setStreak(streakCount);
        setLoading(false);
    }, [user?.id, timezone]);

    useEffect(() => {
        setLoading(true);
        refresh();
        const id = setInterval(refresh, 60_000);
        return () => clearInterval(id);
    }, [refresh]);

    const tooltip = todayDone
        ? `Streak de hoje completo · ${streak} ${streak === 1 ? 'dia' : 'dias'} seguidos`
        : streak > 0
            ? `Streak: ${streak} ${streak === 1 ? 'dia' : 'dias'} · completa o dia no Diário`
            : 'Completa o teu dia no Diário para iniciar o streak';

    return { streak, todayDone, loading, tooltip, refresh };
}
