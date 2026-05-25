import { supabase } from './supabaseClient';
import { FOCUS_STREAK_MIN_SECONDS, TIMEZONE_FALLBACK } from '../components/MyDay/hub/diaryHubConfig';

function rowToProgress(row) {
    if (!row) return null;
    return {
        userId: row.user_id,
        activityDate: row.activity_date,
        tasksCompleted: row.tasks_completed ?? 0,
        focusSeconds: row.focus_seconds ?? 0,
        importantTaskDone: row.important_task_done ?? false,
        minimalGoalMet: row.minimal_goal_met ?? false,
        updatedAt: row.updated_at,
    };
}

/** @returns {string} YYYY-MM-DD in user timezone */
export function getTodayDateKey(timezone = TIMEZONE_FALLBACK) {
    try {
        return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
    } catch {
        return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE_FALLBACK }).format(new Date());
    }
}

export function dayQualifiesForStreak(progress) {
    if (!progress) return false;
    return (
        progress.importantTaskDone === true
        || progress.focusSeconds >= FOCUS_STREAK_MIN_SECONDS
        || progress.minimalGoalMet === true
    );
}

export async function fetchTodayProgress(userId, timezone) {
    if (!userId) return { data: null, error: null };
    const activityDate = getTodayDateKey(timezone);
    const { data, error } = await supabase
        .from('daily_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('activity_date', activityDate)
        .maybeSingle();

    if (error) {
        console.error('[dailyProgressService] fetchTodayProgress', error);
        return { data: null, error: error.message };
    }
    return { data: rowToProgress(data), error: null };
}

export async function fetchProgressHistory(userId, daysBack = 60, timezone) {
    if (!userId) return { data: [], error: null };
    const end = getTodayDateKey(timezone);
    const startDate = new Date(`${end}T12:00:00`);
    startDate.setDate(startDate.getDate() - daysBack);
    const start = startDate.toISOString().slice(0, 10);

    const { data, error } = await supabase
        .from('daily_progress')
        .select('*')
        .eq('user_id', userId)
        .gte('activity_date', start)
        .lte('activity_date', end)
        .order('activity_date', { ascending: false });

    if (error) {
        console.error('[dailyProgressService] fetchProgressHistory', error);
        return { data: [], error: error.message };
    }
    return { data: (data || []).map(rowToProgress), error: null };
}

export async function upsertDailyProgress(userId, patch, timezone) {
    if (!userId) return { data: null, error: 'Usuário não autenticado.' };
    const activityDate = getTodayDateKey(timezone);

    const { data: existing } = await supabase
        .from('daily_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('activity_date', activityDate)
        .maybeSingle();

    const base = existing
        ? {
            tasks_completed: existing.tasks_completed ?? 0,
            focus_seconds: existing.focus_seconds ?? 0,
            important_task_done: existing.important_task_done ?? false,
            minimal_goal_met: existing.minimal_goal_met ?? false,
        }
        : {
            tasks_completed: 0,
            focus_seconds: 0,
            important_task_done: false,
            minimal_goal_met: false,
        };

    const payload = {
        user_id: userId,
        activity_date: activityDate,
        tasks_completed: patch.tasksCompleted ?? base.tasks_completed,
        focus_seconds: patch.focusSeconds ?? base.focus_seconds,
        important_task_done: patch.importantTaskDone ?? base.important_task_done,
        minimal_goal_met: patch.minimalGoalMet ?? base.minimal_goal_met,
        updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
        .from('daily_progress')
        .upsert(payload, { onConflict: 'user_id,activity_date' })
        .select('*')
        .single();

    if (error) {
        console.error('[dailyProgressService] upsertDailyProgress', error);
        return { data: null, error: error.message };
    }
    return { data: rowToProgress(data), error: null };
}

export async function recordFocusSeconds(userId, seconds, timezone) {
    if (!userId || seconds <= 0) return { data: null, error: null };
    const { data: today } = await fetchTodayProgress(userId, timezone);
    const next = (today?.focusSeconds ?? 0) + seconds;
    return upsertDailyProgress(userId, { focusSeconds: next }, timezone);
}

export async function recordTaskCompletion(userId, card, timezone) {
    if (!userId) return { data: null, error: null };
    const { data: today } = await fetchTodayProgress(userId, timezone);
    const isImportant = card.priority === 'urgent' || card.priority === 'high';
    return upsertDailyProgress(userId, {
        tasksCompleted: (today?.tasksCompleted ?? 0) + 1,
        importantTaskDone: (today?.importantTaskDone ?? false) || isImportant,
        minimalGoalMet: true,
    }, timezone);
}

export function computeStreakFromHistory(historyRows, timezone) {
    const qualifying = new Set(
        (historyRows || [])
            .filter(dayQualifiesForStreak)
            .map(r => r.activityDate)
    );

    let streak = 0;
    const cursor = new Date(`${getTodayDateKey(timezone)}T12:00:00`);

    for (let i = 0; i < 366; i++) {
        const key = cursor.toISOString().slice(0, 10);
        if (qualifying.has(key)) {
            streak += 1;
            cursor.setDate(cursor.getDate() - 1);
        } else if (i === 0) {
            // hoje ainda não conta — verifica ontem
            cursor.setDate(cursor.getDate() - 1);
        } else {
            break;
        }
    }

    return streak;
}

export async function computeStreak(userId, timezone) {
    const { data } = await fetchProgressHistory(userId, 90, timezone);
    return computeStreakFromHistory(data, timezone);
}

export function formatFocusDuration(seconds) {
    if (!seconds || seconds < 60) return '0 min';
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
}
