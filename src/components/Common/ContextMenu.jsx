import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight } from 'lucide-react';
import './ContextMenu.css';
import { ContextMenuContext } from './useContextMenu';


const VIEWPORT_MARGIN = 8;

const SUBMENU_HOVER_DELAY_MS = 120;

function hexToRgb(hex) {
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
}

function tintStyle(tint) {
    const rgb = hexToRgb(tint);
    if (!rgb) return {};
    return {
        '--ctx-hover-bg': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.22)`,
        borderColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.55)`,
        backgroundImage: `linear-gradient(135deg, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.18), transparent)`,
    };
}

function clampMenuPosition(rect, preferredX, preferredY) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = preferredX;
    let y = preferredY;

    if (rect.width > vw - VIEWPORT_MARGIN * 2) {
        x = VIEWPORT_MARGIN;
    } else if (rect.right > vw - VIEWPORT_MARGIN) {
        x = vw - rect.width - VIEWPORT_MARGIN;
    } else if (rect.left < VIEWPORT_MARGIN) {
        x = VIEWPORT_MARGIN;
    }

    if (rect.height > vh - VIEWPORT_MARGIN * 2) {
        y = VIEWPORT_MARGIN;
    } else if (rect.bottom > vh - VIEWPORT_MARGIN) {
        y = Math.max(VIEWPORT_MARGIN, vh - VIEWPORT_MARGIN - rect.height);
    } else if (rect.top < VIEWPORT_MARGIN) {
        y = VIEWPORT_MARGIN;
    }

    return { x, y };
}

function ContextMenuItems({ items, onActivate, onSubmenuOpen }) {
    return items.map((item, i) => {
        if (item.type === 'divider') {
            return <div key={`div-${i}`} className="context-menu-divider" />;
        }

        if (item.submenu?.length) {
            return (
                <div
                    key={`sub-${item.label}-${i}`}
                    className="context-menu-submenu-trigger"
                    onMouseEnter={(e) => onSubmenuOpen?.(i, e.currentTarget)}
                    onMouseLeave={() => onSubmenuOpen?.(null)}
                    onFocus={(e) => onSubmenuOpen?.(i, e.currentTarget)}
                    onBlur={() => onSubmenuOpen?.(null)}
                >
                    <button
                        type="button"
                        className={`context-menu-item context-menu-item--submenu ${item.disabled ? 'is-disabled' : ''}`}
                        disabled={item.disabled}
                        aria-haspopup="menu"
                        aria-expanded="false"
                    >
                        {item.icon && <span className="context-menu-icon">{item.icon}</span>}
                        <span className="context-menu-label">{item.label}</span>
                        <ChevronRight size={14} className="context-menu-chevron" aria-hidden />
                    </button>
                </div>
            );
        }

        return (
            <button
                key={`${item.label}-${i}`}
                type="button"
                className={`context-menu-item ${item.danger ? 'context-menu-danger' : ''}`}
                style={item.tint ? tintStyle(item.tint) : undefined}
                onClick={() => {
                    if (!item.disabled) onActivate(item);
                }}
                disabled={item.disabled}
            >
                {item.icon && <span className="context-menu-icon">{item.icon}</span>}
                <span className="context-menu-label">{item.label}</span>
                {item.shortcut && <span className="context-menu-shortcut">{item.shortcut}</span>}
            </button>
        );
    });
}

function ContextMenuSubmenu({ items, anchorEl, parentTint, onActivate, onClose, onCancelClose }) {
    const submenuRef = useRef(null);
    const [pos, setPos] = useState(null);

    useLayoutEffect(() => {
        const run = () => {
            const sub = submenuRef.current;
            const anchor = anchorEl;
            if (!sub || !anchor) return;

            const anchorRect = anchor.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;

            const maxHeight = vh - VIEWPORT_MARGIN * 2;
            const scrollEl = sub.querySelector('.context-menu-scroll');
            if (scrollEl) scrollEl.style.maxHeight = `${maxHeight}px`;

            const subRect = sub.getBoundingClientRect();

            let left = anchorRect.right - 6;
            let top = anchorRect.top;

            if (left + subRect.width > vw - VIEWPORT_MARGIN) {
                left = anchorRect.left - subRect.width + 6;
            }
            if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;

            if (top + subRect.height > vh - VIEWPORT_MARGIN) {
                top = Math.max(VIEWPORT_MARGIN, vh - VIEWPORT_MARGIN - subRect.height);
            }
            if (top < VIEWPORT_MARGIN) top = VIEWPORT_MARGIN;

            setPos({ left, top });
        };

        run();
        const id = requestAnimationFrame(run);
        return () => cancelAnimationFrame(id);
    }, [items, anchorEl]);

    return createPortal(
        <div
            ref={submenuRef}
            className="context-menu context-menu--flyout animate-scale-in"
            style={{
                left: pos?.left ?? -9999,
                top: pos?.top ?? -9999,
                visibility: pos ? 'visible' : 'hidden',
                ...tintStyle(parentTint),
            }}
            onMouseEnter={onCancelClose}
            onMouseLeave={onClose}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            role="menu"
        >
            <div className="context-menu-scroll">
                <ContextMenuItems
                    items={items}
                    onActivate={(item) => {
                        item.action?.();
                        onActivate?.();
                    }}
                />
            </div>
        </div>,
        document.body,
    );
}

export function ContextMenuProvider({ children }) {
    const [menu, setMenu] = useState(null);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [openSubmenuIndex, setOpenSubmenuIndex] = useState(null);
    const [submenuAnchor, setSubmenuAnchor] = useState(null);
    const menuRef = useRef(null);
    const submenuCloseTimer = useRef(null);

    const showContextMenu = useCallback((e, items, options = {}) => {
        e.preventDefault();
        e.stopPropagation();

        const x = e.clientX || e.pageX;
        const y = e.clientY || e.pageY;

        setOpenSubmenuIndex(null);
        setSubmenuAnchor(null);
        setMenu({ x, y, items, options });
        setPos({ x, y });
    }, []);

    const hideContextMenu = useCallback(() => {
        if (submenuCloseTimer.current) {
            clearTimeout(submenuCloseTimer.current);
            submenuCloseTimer.current = null;
        }
        setOpenSubmenuIndex(null);
        setSubmenuAnchor(null);
        setMenu(null);
    }, []);

    const handleSubmenuOpen = useCallback((index, anchorEl) => {
        if (submenuCloseTimer.current) {
            clearTimeout(submenuCloseTimer.current);
            submenuCloseTimer.current = null;
        }
        if (index == null) {
            submenuCloseTimer.current = setTimeout(() => {
                setOpenSubmenuIndex(null);
                setSubmenuAnchor(null);
            }, SUBMENU_HOVER_DELAY_MS);
            return;
        }
        const item = menu?.items?.[index];
        if (!item?.submenu?.length || item.disabled) return;
        setOpenSubmenuIndex(index);
        setSubmenuAnchor(anchorEl);
    }, [menu?.items]);

    const cancelSubmenuClose = useCallback(() => {
        if (submenuCloseTimer.current) {
            clearTimeout(submenuCloseTimer.current);
            submenuCloseTimer.current = null;
        }
    }, []);

    const scheduleSubmenuClose = useCallback(() => {
        submenuCloseTimer.current = setTimeout(() => {
            setOpenSubmenuIndex(null);
            setSubmenuAnchor(null);
        }, SUBMENU_HOVER_DELAY_MS);
    }, []);

    useLayoutEffect(() => {
        if (!menu || !menuRef.current) return;
        const el = menuRef.current;
        const scrollEl = el.querySelector('.context-menu-scroll');
        const maxHeight = window.innerHeight - VIEWPORT_MARGIN * 2;
        if (scrollEl) scrollEl.style.maxHeight = `${maxHeight}px`;

        const rect = el.getBoundingClientRect();
        const next = clampMenuPosition(rect, pos.x, pos.y);
        if (next.x !== pos.x || next.y !== pos.y) setPos(next);
    }, [menu, menu?.items, pos.x, pos.y]);

    useEffect(() => {
        if (!menu) return;

        const handleClose = () => hideContextMenu();
        const handleKey = (e) => {
            if (e.key === 'Escape') hideContextMenu();
        };

        const isInsideMenus = (target) => {
            if (!target) return false;
            if (menuRef.current?.contains(target)) return true;
            return Boolean(target.closest?.('.context-menu--flyout'));
        };

        const handleMouseDown = (e) => {
            if (!isInsideMenus(e.target)) hideContextMenu();
        };

        const handleTouchStart = (e) => {
            if (!isInsideMenus(e.target)) hideContextMenu();
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

    const activeSubmenu = menu && openSubmenuIndex != null
        ? menu.items[openSubmenuIndex]?.submenu
        : null;

    const menuEl = menu && (
        <>
            <div
                ref={menuRef}
                className="context-menu animate-scale-in"
                style={{
                    left: pos.x,
                    top: pos.y,
                    ...tintStyle(menu.options?.tint),
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                role="menu"
            >
                <div className="context-menu-scroll">
                    {menu.options?.title && (
                        <div className="context-menu-title">{menu.options.title}</div>
                    )}
                    <ContextMenuItems
                        items={menu.items}
                        onActivate={(item) => {
                            item.action?.();
                            hideContextMenu();
                        }}
                        onSubmenuOpen={handleSubmenuOpen}
                    />
                </div>
            </div>
            {activeSubmenu?.length > 0 && submenuAnchor && (
                <ContextMenuSubmenu
                    items={activeSubmenu}
                    anchorEl={submenuAnchor}
                    parentTint={menu.options?.tint}
                    onActivate={hideContextMenu}
                    onClose={scheduleSubmenuClose}
                    onCancelClose={cancelSubmenuClose}
                />
            )}
        </>
    );

    return (
        <ContextMenuContext.Provider value={{ showContextMenu, hideContextMenu }}>
            {children}
            {menuEl ? createPortal(menuEl, document.body) : null}
        </ContextMenuContext.Provider>
    );
}



// ── Hook for long-press (mobile) — mais longo que o gesto de drag do DnD; move leve não cancela ──
// `disabled`: ex. cards com DnD em touch — usar só o botão ⋮ para o menu



