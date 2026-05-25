import { supabase } from './supabaseClient';
import { fetchMyInvitations } from './boardService';

export function getReadIdsKey(userId) {
    return userId ? `dailyways_invite_read_${userId}` : null;
}

export function loadReadIds(userId) {
    const key = getReadIdsKey(userId);
    if (!key) return new Set();
    try {
        const raw = window.localStorage.getItem(key);
        const arr = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(arr) ? arr : []);
    } catch {
        return new Set();
    }
}

export function saveReadIds(userId, readSet) {
    const key = getReadIdsKey(userId);
    if (!key) return;
    try {
        window.localStorage.setItem(key, JSON.stringify(Array.from(readSet)));
    } catch {
        /* ignore */
    }
}

export async function fetchNotificationInvitations() {
    const { data, error } = await fetchMyInvitations();
    if (error || !data?.length) {
        return { data: data || [], error };
    }

    const boardIds = [...new Set(data.filter((inv) => inv.kind !== 'space').map((inv) => inv.boardId).filter(Boolean))];
    const spaceIds = [...new Set(data.filter((inv) => inv.kind === 'space').map((inv) => inv.spaceId).filter(Boolean))];

    const boardMap = new Map();
    if (boardIds.length > 0) {
        const { data: boards } = await supabase
            .from('boards')
            .select('id, title, emoji')
            .in('id', boardIds);
        for (const b of boards || []) boardMap.set(b.id, b);
    }

    const spaceMap = new Map();
    if (spaceIds.length > 0) {
        const { data: spaces } = await supabase
            .from('spaces')
            .select('id, title, emoji')
            .in('id', spaceIds);
        for (const s of spaces || []) spaceMap.set(s.id, s);
    }

    return {
        data: data.map((inv) => {
            if (inv.kind === 'space') {
                const s = spaceMap.get(inv.spaceId);
                return {
                    ...inv,
                    spaceTitle: s?.title || inv.spaceTitle || 'Space compartilhado',
                    spaceEmoji: s?.emoji || inv.spaceEmoji || '🌌',
                };
            }
            const b = boardMap.get(inv.boardId);
            return {
                ...inv,
                boardTitle: b?.title || inv.boardTitle || 'Board compartilhado',
                boardEmoji: b?.emoji || inv.boardEmoji || '📋',
            };
        }),
        error: null,
    };
}
