/** Toolbar flutuante do board: arrastar, manter dentro da área, desviar do menu de perfil e lembrar a posição. */
import { useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { computeProfileMenuAvoidance } from '../boardToolbarProfileAvoid';

export function useBoardToolbarDrag(ctx) {
    const {
        showBoardToolbar,
        profileMenuOpen,
        toolbarMembers,
        toolbarMembersLoading,
        narrowBoardLayout,
        toolbarPos,
        setToolbarPos,
        isDragging,
        setIsDragging,
        dragStartRef,
        toolbarRef,
        containerRef,
        board,
    } = ctx;

    // Draggable Logic
    const handleToolbarPointerDown = (e) => {
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('a')) return;
        if (!e.isPrimary) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        let currentX = toolbarPos?.x;
        let currentY = toolbarPos?.y;

        if (currentX === undefined || currentY === undefined) {
            const rect = toolbarRef.current.getBoundingClientRect();
            const containerRect = containerRef.current.getBoundingClientRect();
            currentX = rect.left - containerRect.left;
            currentY = rect.top - containerRect.top;
        }

        dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            posX: currentX,
            posY: currentY
        };
        setIsDragging(true);
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch (_) { /* noop */ }
    };

    const handleToolbarPointerUpGlobal = useCallback(() => {
        setIsDragging(false);
    }, [setIsDragging]);

    useEffect(() => {
        const handleMove = (e) => {
            if (!isDragging) return;
            const deltaX = e.clientX - dragStartRef.current.x;
            const deltaY = e.clientY - dragStartRef.current.y;

            let newX = dragStartRef.current.posX + deltaX;
            let newY = dragStartRef.current.posY + deltaY;

            const width = toolbarRef.current?.offsetWidth || 300;
            const height = toolbarRef.current?.offsetHeight || 50;
            const containerWidth = containerRef.current?.offsetWidth || window.innerWidth;
            const containerHeight = containerRef.current?.offsetHeight || window.innerHeight;
            const padding = 10;

            newX = Math.max(padding, Math.min(newX, containerWidth - width - padding));
            newY = Math.max(padding, Math.min(newY, containerHeight - height - padding));

            setToolbarPos({ x: newX, y: newY });
        };

        if (isDragging) {
            document.addEventListener('pointermove', handleMove, { passive: false });
            document.addEventListener('pointerup', handleToolbarPointerUpGlobal);
            document.addEventListener('pointercancel', handleToolbarPointerUpGlobal);
        }
        return () => {
            document.removeEventListener('pointermove', handleMove);
            document.removeEventListener('pointerup', handleToolbarPointerUpGlobal);
            document.removeEventListener('pointercancel', handleToolbarPointerUpGlobal);
        };
    }, [isDragging, handleToolbarPointerUpGlobal, dragStartRef, toolbarRef, containerRef, setToolbarPos]);

    /** Deslocamento temporário (viewport px) — não altera toolbarPos; zera ao fechar o menu. */
    const [profileAvoidTranslate, setProfileAvoidTranslate] = useState({ x: 0, y: 0 });

    useLayoutEffect(() => {
        if (!profileMenuOpen || !showBoardToolbar) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- medição de layout do DOM antes do paint
            setProfileAvoidTranslate({ x: 0, y: 0 });
            return undefined;
        }

        const run = () => {
            const boardEl = containerRef.current;
            const menuEl = document.querySelector('[data-profile-menu-dropdown]')
                || document.querySelector('.header-profile-dropdown');
            const toolEl = toolbarRef.current;
            if (!boardEl || !menuEl || !toolEl) {
                setProfileAvoidTranslate({ x: 0, y: 0 });
                return;
            }
            const boardRect = boardEl.getBoundingClientRect();
            const menuRect = menuEl.getBoundingClientRect();
            if (menuRect.width < 2 || menuRect.height < 2) {
                return;
            }
            /* Medir posição “natural” sem o deslocamento de evitação do frame anterior */
            const prevTransform = toolEl.style.transform;
            toolEl.style.transform = 'none';
            const toolRect = toolEl.getBoundingClientRect();
            toolEl.style.transform = prevTransform;

            setProfileAvoidTranslate(
                computeProfileMenuAvoidance(toolRect, menuRect, boardRect),
            );
        };

        run();
        const raf1 = requestAnimationFrame(() => {
            run();
            requestAnimationFrame(run);
        });
        window.addEventListener('resize', run);

        let ro;
        if (typeof ResizeObserver !== 'undefined') {
            ro = new ResizeObserver(run);
            const menuEl = document.querySelector('[data-profile-menu-dropdown]')
                || document.querySelector('.header-profile-dropdown');
            if (menuEl) ro.observe(menuEl);
            if (toolbarRef.current) ro.observe(toolbarRef.current);
        }

        return () => {
            cancelAnimationFrame(raf1);
            window.removeEventListener('resize', run);
            ro?.disconnect();
        };
    }, [profileMenuOpen, showBoardToolbar, toolbarPos?.x, toolbarPos?.y, board?.id, narrowBoardLayout, toolbarMembers.length, toolbarMembersLoading, containerRef, toolbarRef]);

    const toolbarDefaultBottomCorner = narrowBoardLayout && toolbarPos == null;

    const toolbarAvoidTransform = useMemo(() => {
        if (!profileMenuOpen || isDragging) return 'none';
        const { x, y } = profileAvoidTranslate;
        if (!x && !y) return 'none';
        return `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }, [profileMenuOpen, profileAvoidTranslate, isDragging]);

    return {
        handleToolbarPointerDown,
        toolbarDefaultBottomCorner,
        toolbarAvoidTransform,
    };
}
