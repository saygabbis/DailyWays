import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import {
    computeStreak,
    fetchTodayProgress,
    formatFocusDuration,
    recordTaskCompletion,
} from '../services/dailyProgressService';
import {
    calcCategoryProgress,
    calcDayXp,
    calcOverallDayProgress,
    getDayMotivationalPhrase,
    groupMissionsByCategory,
    pickNextFocusTask,
} from '../components/MyDay/hub/diaryHubUtils';
import { TIMEZONE_FALLBACK } from '../components/MyDay/hub/diaryHubConfig';

export function useDiaryHub() {
    const { getMyDayCards, getMyDayCardsAll } = useApp();
    const { user } = useAuth();
    const [todayProgress, setTodayProgress] = useState(null);
    const [streak, setStreak] = useState(0);
    const [loading, setLoading] = useState(true);

    const timezone = user?.timezone || TIMEZONE_FALLBACK;
    const cards = getMyDayCards();
    const allMyDay = getMyDayCardsAll();
    const completedToday = allMyDay.filter(c => c.completed || c.isCompletionList).length;
    const nextFocusTask = useMemo(() => pickNextFocusTask(cards), [cards]);
    const missionGroups = useMemo(() => groupMissionsByCategory(cards), [cards]);
    const dayXp = useMemo(() => calcDayXp(allMyDay), [allMyDay]);
    const overallPercent = useMemo(() => calcOverallDayProgress(allMyDay), [allMyDay]);
    const categoryProgress = useMemo(() => ({
        essential: calcCategoryProgress(allMyDay, 'essential'),
        creative: calcCategoryProgress(allMyDay, 'creative'),
        self: calcCategoryProgress(allMyDay, 'self'),
    }), [allMyDay]);
    const motivationalPhrase = useMemo(() => getDayMotivationalPhrase(), []);

    const refreshProgress = useCallback(async () => {
        if (!user?.id) {
            setLoading(false);
            return;
        }
        const [{ data: today }, streakCount] = await Promise.all([
            fetchTodayProgress(user.id, timezone),
            computeStreak(user.id, timezone),
        ]);
        setTodayProgress(today);
        setStreak(streakCount);
        setLoading(false);
    }, [user?.id, timezone]);

    useEffect(() => {
        setLoading(true);
        refreshProgress();
    }, [refreshProgress]);

    useEffect(() => {
        const handler = () => refreshProgress();
        window.addEventListener('diary-focus-complete', handler);
        return () => window.removeEventListener('diary-focus-complete', handler);
    }, [refreshProgress]);

    const onTaskCompleted = useCallback(async (card) => {
        if (!user?.id || !card?.myDay) return;
        await recordTaskCompletion(user.id, card, timezone);
        await refreshProgress();
    }, [user?.id, timezone, refreshProgress]);

    const focusDisplay = formatFocusDuration(todayProgress?.focusSeconds ?? 0);

    return {
        cards,
        completedToday,
        totalToday: allMyDay.length,
        nextFocusTask,
        missionGroups,
        dayXp,
        overallPercent,
        categoryProgress,
        motivationalPhrase,
        streak,
        todayProgress,
        focusDisplay,
        loading,
        refreshProgress,
        onTaskCompleted,
    };
}
