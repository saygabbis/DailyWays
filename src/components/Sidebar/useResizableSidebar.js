/** Largura da sidebar arrastável (200–400px), lembrada no localStorage e exposta em --sidebar-width. */
import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'dailyways_sidebar_width';
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

function readStoredWidth() {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

export function useResizableSidebar(defaultWidth = 260) {
    const sidebarRef = useRef(null);
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const stored = readStoredWidth();
        const parsed = stored ? parseInt(stored, 10) : NaN;
        return Number.isFinite(parsed) ? Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, parsed)) : defaultWidth;
    });
    const isResizing = useRef(false);

    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        isResizing.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const handleMouseMove = (e) => {
            if (!isResizing.current) return;
            const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
            setSidebarWidth(newWidth);
        };

        const handleMouseUp = () => {
            isResizing.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, []);

    useEffect(() => {
        try { localStorage.setItem(STORAGE_KEY, String(sidebarWidth)); } catch { /* storage indisponível */ }
        document.documentElement.style.setProperty('--sidebar-width', `${sidebarWidth}px`);
    }, [sidebarWidth]);

    return { sidebarRef, sidebarWidth, handleMouseDown };
}
