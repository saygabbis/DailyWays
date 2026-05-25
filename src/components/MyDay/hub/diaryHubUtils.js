import { isToday } from 'date-fns';
import { isCardImportant } from '../../../utils/cardImportant';
import {
    CATEGORY_ORDER,
    DAY_CATEGORIES,
    MOTIVATIONAL_PHRASES,
    PRIORITY_ORDER,
} from './diaryHubConfig';

export function normalizeDayCategory(category) {
    if (category && DAY_CATEGORIES[category]) return category;
    return 'essential';
}

export function pickNextFocusTask(cards) {
    const pending = (cards || []).filter(c => !c.completed);
    if (pending.length === 0) return null;

    const sorted = [...pending].sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority] ?? 4;
        const pb = PRIORITY_ORDER[b.priority] ?? 4;
        if (pa !== pb) return pa - pb;

        const ca = normalizeDayCategory(a.dayCategory) === 'essential' ? 0 : 1;
        const cb = normalizeDayCategory(b.dayCategory) === 'essential' ? 0 : 1;
        if (ca !== cb) return ca - cb;

        const aDue = a.dueDate && isToday(new Date(a.dueDate)) ? 0 : 1;
        const bDue = b.dueDate && isToday(new Date(b.dueDate)) ? 0 : 1;
        if (aDue !== bDue) return aDue - bDue;

        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        return aTime - bTime;
    });

    return sorted[0];
}

export function groupMissionsByCategory(cards) {
    const groups = { essential: [], creative: [], self: [] };
    (cards || []).forEach(card => {
        const key = normalizeDayCategory(card.dayCategory);
        groups[key].push(card);
    });
    CATEGORY_ORDER.forEach(key => {
        groups[key].sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            const pa = PRIORITY_ORDER[a.priority] ?? 4;
            const pb = PRIORITY_ORDER[b.priority] ?? 4;
            return pa - pb;
        });
    });
    return groups;
}

export function getDayMotivationalPhrase(date = new Date()) {
    const dayIndex = date.getDate() + date.getMonth() * 31;
    return MOTIVATIONAL_PHRASES[dayIndex % MOTIVATIONAL_PHRASES.length];
}

export function getEstimatedMinutes(card) {
    if (card?.estimatedMinutes != null && card.estimatedMinutes > 0) {
        return card.estimatedMinutes;
    }
    if (card?.journalMeta?.estimatedMinutes != null && card.journalMeta.estimatedMinutes > 0) {
        return card.journalMeta.estimatedMinutes;
    }
    return null;
}

export function calcDayXp(cards) {
    const completed = (cards || []).filter(c => c.completed);
    let xp = completed.length * 10;
    const selfDone = completed.some(c => normalizeDayCategory(c.dayCategory) === 'self');
    if (selfDone) xp += 5;
    return xp;
}

export function calcCategoryProgress(cards, categoryId) {
    const inCat = (cards || []).filter(c => normalizeDayCategory(c.dayCategory) === categoryId);
    if (inCat.length === 0) return { total: 0, completed: 0, percent: 0 };
    const completed = inCat.filter(c => c.completed).length;
    return {
        total: inCat.length,
        completed,
        percent: Math.round((completed / inCat.length) * 100),
    };
}

export function calcOverallDayProgress(cards) {
    const all = cards || [];
    if (all.length === 0) return 0;
    const done = all.filter(c => c.completed).length;
    return Math.round((done / all.length) * 100);
}

export function isImportantMyDayCard(card) {
    return isCardImportant(card);
}
