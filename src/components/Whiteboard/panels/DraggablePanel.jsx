import React, { useState, useRef, useCallback, useEffect } from 'react';
import './DraggablePanel.css';

const STORAGE_KEY = 'dailyways_panel_positions';

function loadPosition(panelId) {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const map = raw ? JSON.parse(raw) : {};
        return map[panelId] ?? null;
    } catch {
        return null;
    }
}

function savePosition(panelId, pos) {
    try {
        const raw = localStorage.getItem(STORAGE_KEY) || '{}';
        const map = JSON.parse(raw);
        map[panelId] = pos;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {}
}

export default function DraggablePanel({ id, defaultPosition = { left: 0, top: 0 }, defaultBottom, hideHandle, children, className = '', style = {} }) {
    const saved = loadPosition(id);
    const useBottomDefault = !saved && defaultBottom != null;
    const [position, setPosition] = useState(saved || defaultPosition);
    const positionRef = useRef(position);
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const panelRef = useRef(null);
    positionRef.current = position;

    useEffect(() => {
        if (saved) setPosition(saved);
    }, [id]);

    const handleMouseDown = useCallback(
        (e) => {
            if (!e.target.closest('.draggable-panel-handle')) return;
            e.preventDefault();
            let startPos = position;
            if (useBottomDefault && panelRef.current) {
                const rect = panelRef.current.getBoundingClientRect();
                startPos = { left: rect.left, top: rect.top };
                setPosition(startPos);
                positionRef.current = startPos;
            }
            setIsDragging(true);
            dragStart.current = { x: e.clientX - startPos.left, y: e.clientY - startPos.top };
        },
        [position, useBottomDefault]
    );

    useEffect(() => {
        if (!isDragging) return;
        const onMove = (e) => {
            const next = { left: e.clientX - dragStart.current.x, top: e.clientY - dragStart.current.y };
            setPosition(next);
            positionRef.current = next;
        };
        const onUp = () => {
            setIsDragging(false);
            savePosition(id, positionRef.current);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [isDragging, id]);

    const useBottomStyle = useBottomDefault && !isDragging;
    return (
        <div
            ref={panelRef}
            className={`draggable-panel ${className}`}
            style={{
                position: 'fixed',
                ...(useBottomStyle
                    ? { bottom: defaultBottom, left: '50%', transform: 'translateX(-50%)', top: 'auto' }
                    : { left: position.left, top: position.top }),
                zIndex: 9999,
                ...style,
            }}
        >
            {!hideHandle && <div className="draggable-panel-handle" onMouseDown={handleMouseDown} />}
            <div className="draggable-panel-content" style={{ paddingTop: hideHandle ? 0 : 28 }}>{children}</div>
        </div>
    );
}
