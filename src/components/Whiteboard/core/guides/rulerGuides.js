import { DEFAULT_PAGE_ID } from '../pages/whiteboardPages';

export function filterGuidesByPage(guides, pageId) {
    const pid = pageId ?? DEFAULT_PAGE_ID;
    return (guides ?? []).filter((g) => (g.pageId ?? DEFAULT_PAGE_ID) === pid);
}

export function cloneGuide(guide) {
    return JSON.parse(JSON.stringify(guide));
}
