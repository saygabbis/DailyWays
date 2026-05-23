import { uuidv4 } from '../../../../utils/uuid';

export const DEFAULT_PAGE_ID = 'page-main';

export function loadSpacePages(spaceId) {
    if (!spaceId) {
        return [{ id: DEFAULT_PAGE_ID, name: 'Canvas principal' }];
    }
    try {
        const raw = localStorage.getItem(`dailyways_space_pages_${spaceId}`);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length) return parsed;
        }
    } catch {}
    return [{ id: DEFAULT_PAGE_ID, name: 'Canvas principal' }];
}

export function saveSpacePages(spaceId, pages) {
    if (!spaceId) return;
    try {
        localStorage.setItem(`dailyways_space_pages_${spaceId}`, JSON.stringify(pages));
    } catch {}
}

export function getNodePageId(node) {
    return node?.data?.pageId ?? DEFAULT_PAGE_ID;
}

export function filterNodesByPage(nodes, pageId) {
    const pid = pageId ?? DEFAULT_PAGE_ID;
    return (nodes ?? []).filter((n) => getNodePageId(n) === pid);
}

export function newPageName(pages) {
    return `Página ${(pages?.length ?? 0) + 1}`;
}

export function createPageEntry(name) {
    return { id: uuidv4(), name: name || 'Nova página' };
}
