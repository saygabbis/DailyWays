const LOCKED_GUIDES_KEY_PREFIX = 'dailyways_locked_guides_';

export function loadLockedGuideIds(spaceId) {
    if (!spaceId) return new Set();
    try {
        const raw = localStorage.getItem(`${LOCKED_GUIDES_KEY_PREFIX}${spaceId}`);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return new Set();
        return new Set(parsed.filter((id) => typeof id === 'string'));
    } catch {
        return new Set();
    }
}

export function saveLockedGuideIds(spaceId, ids) {
    if (!spaceId) return;
    try {
        const list = [...(ids instanceof Set ? ids : ids ?? [])];
        localStorage.setItem(`${LOCKED_GUIDES_KEY_PREFIX}${spaceId}`, JSON.stringify(list));
    } catch {}
}

export function pruneLockedGuideIds(spaceId, removedIds) {
    if (!spaceId || !removedIds?.length) return;
    const locked = loadLockedGuideIds(spaceId);
    const remove = new Set(removedIds);
    let changed = false;
    for (const id of remove) {
        if (locked.delete(id)) changed = true;
    }
    if (changed) saveLockedGuideIds(spaceId, locked);
}
