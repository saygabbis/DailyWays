import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { Trash2, Edit3, Palette, Copy, Sun, Star, Calendar, Tag, ArrowRight, SortAsc } from 'lucide-react';
import './ContextMenu.css';

const ContextMenuContext = createContext(null);

export function ContextMenuProvider({ children }) {
    const [menu, setMenu] = useState(null);
    const menuRef = useRef(null);

    const showContextMenu = useCallback((e, items, options = {}) => {
        e.preventDefault();
        e.stopPropagation();

        let x = e.clientX || e.pageX;
        let y = e.clientY || e.pageY;

        setMenu({ x, y, items, options });
    }, []);

    const hideContextMenu = useCallback(() => {
        setMenu(null);
    }, []);

    // Position adjustment after render
    useEffect(() => {
        if (menu && menuRef.current) {
            const el = menuRef.current;
            const rect = el.getBoundingClientRect();
            let { x, y } = menu;
            let adjusted = false;

            if (rect.right > window.innerWidth - 8) {
                x = window.innerWidth - rect.width - 8;
                adjusted = true;
            }
            if (rect.bottom > window.innerHeight - 8) {
                y = window.innerHeight - rect.height - 8;
                adjusted = true;
            }
            if (x < 8) { x = 8; adjusted = true; }
            if (y < 8) { y = 8; adjusted = true; }

            if (adjusted) setMenu(prev => prev ? { ...prev, x, y } : null);
        }
    }, [menu?.items]);

    // Close on any outside interaction: click, mousedown (drag start),
    // touchstart (mobile), scroll, resize, escape, or new context menu
    useEffect(() => {
        if (!menu) return;

        const handleClose = () => hideContextMenu();
        const handleKey = (e) => { if (e.key === 'Escape') hideContextMenu(); };

        // mousedown catches drag starts before click fires
        const handleMouseDown = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                hideContextMenu();
            }
        };

        // touchstart for mobile taps outside
        const handleTouchStart = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                hideContextMenu();
            }
        };

        document.addEventListener('click', handleClose);
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('scroll', handleClose, true);
        document.addEventListener('keydown', handleKey);
        document.addEventListener('contextmenu', handleClose);
        window.addEventListener('resize', handleClose);

        return () => {
            document.removeEventListener('click', handleClose);
            document.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('scroll', handleClose, true);
            document.removeEventListener('keydown', handleKey);
            document.removeEventListener('contextmenu', handleClose);
            window.removeEventListener('resize', handleClose);
        };
    }, [menu, hideContextMenu]);

    return (
        <ContextMenuContext.Provider value={{ showContextMenu, hideContextMenu }}>
            {children}
            {menu && (
                <div
                    ref={menuRef}
                    className="context-menu animate-scale-in"
                    style={{ left: menu.x, top: menu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {menu.options.title && (
                        <div className="context-menu-title">{menu.options.title}</div>
                    )}
                    {menu.items.map((item, i) => {
                        if (item.type === 'divider') {
                            return <div key={`div-${i}`} className="context-menu-divider" />;
                        }
                        return (
                            <button
                                key={item.label}
                                className={`context-menu-item ${item.danger ? 'context-menu-danger' : ''}`}
                                onClick={() => {
                                    item.action();
                                    hideContextMenu();
                                }}
                                disabled={item.disabled}
                            >
                                {item.icon && <span className="context-menu-icon">{item.icon}</span>}
                                <span className="context-menu-label">{item.label}</span>
                                {item.shortcut && <span className="context-menu-shortcut">{item.shortcut}</span>}
                            </button>
                        );
                    })}
                </div>
            )}
        </ContextMenuContext.Provider>
    );
}

export const useContextMenu = () => {
    const ctx = useContext(ContextMenuContext);
    if (!ctx) throw new Error('useContextMenu must be used within ContextMenuProvider');
    return ctx;
};

// ── Hook for long-press (mobile) ──
export function useLongPress(callback, ms = 500) {
    const timerRef = useRef(null);
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    const start = useCallback((e) => {
        // Prevent default to avoid text selection on mobile
        timerRef.current = setTimeout(() => {
            // Create a synthetic event with touch position
            const touch = e.touches?.[0];
            if (touch) {
                callbackRef.current({
                    preventDefault: () => e.preventDefault(),
                    stopPropagation: () => e.stopPropagation(),
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    pageX: touch.pageX,
                    pageY: touch.pageY,
                });
            }
        }, ms);
    }, [ms]);

    const cancel = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    return {
        onTouchStart: start,
        onTouchEnd: cancel,
        onTouchMove: cancel,
    };
}
