import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

function computeMenuStyle(anchorEl, orientation) {
    if (!anchorEl) return {};
    const rect = anchorEl.getBoundingClientRect();
    const gap = 4;

    if (orientation === 'vertical') {
        const openUpward = rect.top > window.innerHeight * 0.55;
        if (openUpward) {
            return {
                position: 'fixed',
                left: rect.left + rect.width / 2,
                bottom: window.innerHeight - rect.top + gap,
                transform: 'translateX(-50%)',
            };
        }
        return {
            position: 'fixed',
            left: rect.right + gap,
            top: rect.top,
        };
    }

    return {
        position: 'fixed',
        left: rect.right + gap,
        top: rect.top,
    };
}

/**
 * Menu suspenso genérico da toolbar (vertical ou horizontal).
 * Usa portal para não ser cortado por overflow dos pais (DraggablePanel, .left-toolbar-tools).
 */
export default function ToolbarToolMenu({
    open,
    onClose,
    children,
    className = '',
    orientation = 'vertical',
    anchorRef,
    triggerRef,
}) {
    const menuRef = useRef(null);
    const [menuStyle, setMenuStyle] = useState({});

    const updatePosition = () => {
        const anchorEl = anchorRef?.current;
        if (!anchorEl) return;
        setMenuStyle(computeMenuStyle(anchorEl, orientation));
    };

    useLayoutEffect(() => {
        if (!open) return;
        updatePosition();
    }, [open, orientation, anchorRef]);

    useEffect(() => {
        if (!open) return undefined;
        const onReposition = () => updatePosition();
        window.addEventListener('resize', onReposition);
        window.addEventListener('scroll', onReposition, true);
        return () => {
            window.removeEventListener('resize', onReposition);
            window.removeEventListener('scroll', onReposition, true);
        };
    }, [open, orientation, anchorRef]);

    useEffect(() => {
        if (!open) return undefined;
        const onPointerDown = (e) => {
            const target = e.target;
            const inMenu = menuRef.current?.contains(target);
            const inTrigger = triggerRef?.current?.contains(target);
            if (!inMenu && !inTrigger) onClose?.();
        };
        const onKey = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown, true);
            document.removeEventListener('keydown', onKey);
        };
    }, [open, onClose, triggerRef]);

    if (!open) return null;

    const menuEl = (
        <div
            ref={menuRef}
            className={`left-toolbar-menu left-toolbar-menu--${orientation} left-toolbar-menu--portal ${className}`.trim()}
            style={anchorRef ? menuStyle : undefined}
            role="menu"
        >
            {children}
        </div>
    );

    if (anchorRef) {
        return createPortal(menuEl, document.body);
    }

    return menuEl;
}
