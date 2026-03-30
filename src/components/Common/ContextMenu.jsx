import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, Edit3, Palette, Copy, Sun, Star, Calendar, Tag, ArrowRight, SortAsc } from 'lucide-react';
import './ContextMenu.css';

const ContextMenuContext = createContext(null);

export function ContextMenuProvider({ children }) {
    const [menu, setMenu] = useState(null);
    const menuRef = useRef(null);

    const hexToRgb = (hex) => {
        if (!hex || typeof hex !== 'string') return null;
        const h = hex.trim();
        if (!h.startsWith('#')) return null;
        const s = h.slice(1);
        if (s.length !== 6) return null;
        const r = parseInt(s.slice(0, 2), 16);
        const g = parseInt(s.slice(2, 4), 16);
        const b = parseInt(s.slice(4, 6), 16);
        if ([r, g, b].some((v) => Number.isNaN(v))) return null;
        return { r, g, b };
    };

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

    const menuEl = menu && (
        <div
            ref={menuRef}
            className="context-menu animate-scale-in"
            style={{
                left: menu.x,
                top: menu.y,
                ...(menu.options?.tint && (() => {
                    const rgb = hexToRgb(menu.options.tint);
                    if (!rgb) return {};
                    return {
                        '--ctx-hover-bg': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.22)`,
                        borderColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.55)`,
                        backgroundImage: `linear-gradient(135deg, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.18), transparent)`,
                    };
                })())
            }}
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
    );

    return (
        <ContextMenuContext.Provider value={{ showContextMenu, hideContextMenu }}>
            {children}
            {menuEl ? createPortal(menuEl, document.body) : null}
        </ContextMenuContext.Provider>
    );
}

export const useContextMenu = () => {
    const ctx = useContext(ContextMenuContext);
    if (!ctx) throw new Error('useContextMenu must be used within ContextMenuProvider');
    return ctx;
};

// ── Hook for long-press (mobile) — mais longo que o gesto de drag do DnD; move leve não cancela ──
// `disabled`: ex. cards com DnD em touch — usar só o botão ⋮ para o menu
const MOVE_CANCEL_PX = 12;

export function useLongPress(callback, ms, { disabled = false } = {}) {
    const timerRef = useRef(null);
    const posRef = useRef({ x: 0, y: 0 });
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    const resolveMs = useCallback(() => {
        if (ms != null) return ms;
        if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) return 880;
        return 550;
    }, [ms]);

    const cancel = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const start = useCallback((e) => {
        if (disabled) return;
        const touch = e.touches?.[0];
        if (touch) {
            posRef.current = { x: touch.clientX, y: touch.clientY };
        } else {
            posRef.current = { x: e.clientX, y: e.clientY };
        }
        const delay = resolveMs();
        timerRef.current = setTimeout(() => {
            callbackRef.current({
                preventDefault: () => {},
                stopPropagation: () => {},
                clientX: posRef.current.x,
                clientY: posRef.current.y,
                pageX: posRef.current.x,
                pageY: posRef.current.y,
            });
        }, delay);
    }, [disabled, resolveMs]);

    const onTouchMove = useCallback((e) => {
        if (disabled) return;
        const touch = e.touches?.[0];
        if (!touch || !timerRef.current) return;
        const dx = touch.clientX - posRef.current.x;
        const dy = touch.clientY - posRef.current.y;
        if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) cancel();
    }, [cancel, disabled]);

    const onTouchEndWrap = useCallback((e) => {
        cancel();
    }, [cancel]);

    const onTouchCancelWrap = useCallback((e) => {
        cancel();
    }, [cancel]);

    if (disabled) {
        return {
            cancel,
            onTouchStart: undefined,
            onTouchEnd: undefined,
            onTouchMove: undefined,
            onTouchCancel: undefined,
        };
    }

    return {
        cancel,
        onTouchStart: start,
        onTouchEnd: onTouchEndWrap,
        onTouchMove: onTouchMove,
        onTouchCancel: onTouchCancelWrap,
    };
}
