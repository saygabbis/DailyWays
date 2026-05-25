import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useSmartViewCompletionStore } from '../stores/smartViewCompletionStore.js';

export function useSmartViewRecentCompletions() {
    const { getAllCards } = useApp();
    const entries = useSmartViewCompletionStore((s) => s.entries);

    return useMemo(() => {
        const all = getAllCards();
        const byKey = new Map(all.map((c) => [`${c.boardId}:${c.id}`, c]));

        return entries
            .map((entry) => {
                const live = byKey.get(`${entry.boardId}:${entry.cardId}`);
                if (!live) return null;
                if (!live.completed && !live.isCompletionList) return null;
                return {
                    ...live,
                    completedAt: entry.completedAt,
                };
            })
            .filter(Boolean)
            .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
    }, [entries, getAllCards]);
}
