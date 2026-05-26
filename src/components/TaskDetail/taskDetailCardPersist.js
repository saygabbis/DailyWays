/** Delta de campos do card para persistência / undo por ação no modal de tarefa. */

export const TASK_CARD_PERSIST_FIELDS = [
    'title',
    'description',
    'priority',
    'startDate',
    'dueDate',
    'recurrenceRule',
    'isAllDay',
    'myDay',
    'dayCategory',
    'estimatedMinutes',
    'labels',
    'color',
    'coverAttachmentId',
    'coverPreviewUrl',
    'completed',
];

function normFieldValue(key, value) {
    if (value === undefined || value === '') return null;
    if (key === 'recurrenceRule' && (value === 'none' || value === null)) return null;
    if (key === 'estimatedMinutes') {
        if (value === '' || value == null) return null;
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }
    if (key === 'labels') return JSON.stringify(value || []);
    return value;
}

export function snapshotFromCard(card) {
    if (!card) return {};
    return {
        title: card.title ?? '',
        description: card.description ?? '',
        priority: card.priority || 'none',
        startDate: card.startDate || null,
        dueDate: card.dueDate || null,
        recurrenceRule: card.recurrenceRule || 'none',
        isAllDay: card.isAllDay ?? true,
        myDay: !!card.myDay,
        dayCategory: card.dayCategory || 'essential',
        estimatedMinutes: card.estimatedMinutes ?? '',
        labels: [...(card.labels || [])],
        color: card.color ?? null,
        coverAttachmentId: card.coverAttachmentId ?? null,
        coverPreviewUrl: card.coverPreviewUrl ?? null,
        completed: !!card.completed,
    };
}

export function buildCardPersistDelta(base, next) {
    const delta = {};
    for (const key of TASK_CARD_PERSIST_FIELDS) {
        const a = normFieldValue(key, base[key]);
        const b = normFieldValue(key, next[key]);
        if (a !== b) {
            if (key === 'recurrenceRule') {
                delta[key] = b == null ? null : next[key];
            } else if (key === 'labels') {
                delta[key] = next[key] || [];
            } else {
                delta[key] = next[key];
            }
        }
    }
    return delta;
}

export function mergeCardPersistBase(base, delta) {
    const merged = { ...base, ...delta };
    if ('labels' in delta) merged.labels = [...(delta.labels || [])];
    return merged;
}
