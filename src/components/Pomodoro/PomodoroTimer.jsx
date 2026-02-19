import { useState, useEffect, useRef, useCallback } from 'react';
import { usePomodoro } from '../../context/PomodoroContext';
import { Play, Pause, RotateCcw, X, Minimize2, Settings, ChevronLeft, Maximize2 } from 'lucide-react';
import './PomodoroTimer.css';

export default function PomodoroTimer() {
    const {
        timeLeft, isActive, mode, isOpen, isMinimized, setIsOpen,
        toggleTimer, resetTimer, setTimerMode, formatTime, progress,
        toggleMinimize, setTimeLeft
    } = usePomodoro();

    const [showSettings, setShowSettings] = useState(false);
    const [customMinutes, setCustomMinutes] = useState('25');
    const [position, setPosition] = useState({ x: window.innerWidth - 320, y: window.innerHeight - 400 });
    const [dimensions, setDimensions] = useState(() => {
        const saved = localStorage.getItem('pomodoro_size');
        // Reduced default height to 320 to avoid empty space
        return saved ? JSON.parse(saved) : { width: 300, height: 320 };
    });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [isActuallyDragging, setIsActuallyDragging] = useState(false);

    const dragDistance = useRef(0);
    const dragStartOffset = useRef({ x: 0, y: 0 });
    const resizeStartSize = useRef({ width: 0, height: 0, x: 0, y: 0 });
    const initialPinchDistance = useRef(0);
    const longPressTimer = useRef(null);
    const widgetRef = useRef(null);

    // Initial position & size on mount
    useEffect(() => {
        if (isOpen) {
            const savedPos = localStorage.getItem('pomodoro_pos');
            if (savedPos) setPosition(JSON.parse(savedPos));

            const savedSize = localStorage.getItem('pomodoro_size');
            if (savedSize) setDimensions(JSON.parse(savedSize));
        }
    }, [isOpen]);

    const handleMouseDown = useCallback((e) => {
        // Only drag if header or minimized pill is clicked
        const isHeader = e.target.closest('.pomodoro-header');
        const isMinimizedPill = e.target.closest('.pomodoro-minimized-content');

        if (isHeader || isMinimizedPill) {
            dragDistance.current = 0;
            dragStartOffset.current = {
                x: e.clientX,
                y: e.clientY,
                posX: position.x,
                posY: position.y
            };

            setIsDragging(true);
        }
    }, [position]);

    const handleMouseUpGlobal = useCallback(() => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
        setIsDragging(false);
        setIsActuallyDragging(false);
        setIsResizing(false);
    }, []);

    const handleResizeMouseDown = (e) => {
        e.stopPropagation();
        e.preventDefault();
        setIsResizing(true);
        resizeStartSize.current = {
            width: dimensions.width,
            height: dimensions.height,
            x: e.clientX,
            y: e.clientY
        };
    };

    // Pinch zoom for mobile
    const handleTouchStart = (e) => {
        if (e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].pageX - e.touches[1].pageX,
                e.touches[0].pageY - e.touches[1].pageY
            );
            initialPinchDistance.current = dist;
            resizeStartSize.current = { ...dimensions };
        }
    };

    const handleTouchMove = (e) => {
        if (e.touches.length === 2 && initialPinchDistance.current > 0) {
            const dist = Math.hypot(
                e.touches[0].pageX - e.touches[1].pageX,
                e.touches[0].pageY - e.touches[1].pageY
            );
            const factor = dist / initialPinchDistance.current;

            const newWidth = Math.min(600, Math.max(isMinimized ? 120 : 250, resizeStartSize.current.width * factor));
            const newHeight = Math.min(800, Math.max(isMinimized ? 40 : 300, resizeStartSize.current.height * factor));

            setDimensions({ width: newWidth, height: newHeight });
        }
    };

    const handleTouchEnd = () => {
        initialPinchDistance.current = 0;
        localStorage.setItem('pomodoro_size', JSON.stringify(dimensions));
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isDragging && !isResizing) {
                const deltaX = e.clientX - dragStartOffset.current.x;
                const deltaY = e.clientY - dragStartOffset.current.y;
                const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

                if (dist > 3 || isActuallyDragging) {
                    if (!isActuallyDragging) setIsActuallyDragging(true);

                    let newX = dragStartOffset.current.posX + deltaX;
                    let newY = dragStartOffset.current.posY + deltaY;
                    dragDistance.current = dist;

                    const padding = 10;
                    const width = widgetRef.current?.offsetWidth || dimensions.width;
                    const height = widgetRef.current?.offsetHeight || dimensions.height;

                    newX = Math.max(padding, Math.min(newX, window.innerWidth - width - padding));
                    newY = Math.max(padding, Math.min(newY, window.innerHeight - height - padding));

                    const newPos = { x: newX, y: newY };
                    setPosition(newPos);
                    localStorage.setItem('pomodoro_pos', JSON.stringify(newPos));
                }
            } else if (isResizing) {
                const deltaX = e.clientX - resizeStartSize.current.x;
                const deltaY = e.clientY - resizeStartSize.current.y;

                const minW = isMinimized ? 120 : 250;
                const minH = isMinimized ? 45 : 200;

                const newWidth = Math.min(800, Math.max(minW, resizeStartSize.current.width + deltaX));
                const newHeight = Math.min(1000, Math.max(minH, resizeStartSize.current.height + deltaY));

                const newSize = { width: newWidth, height: newHeight };
                setDimensions(newSize);
                localStorage.setItem('pomodoro_size', JSON.stringify(newSize));
            }
        };

        if (isDragging || isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUpGlobal);
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUpGlobal);
        };
    }, [isDragging, isActuallyDragging, isResizing, position, handleMouseUpGlobal]);

    if (!isOpen) return null;

    const handleMinimizedClick = () => {
        // Only expand if we didn't drag it much
        if (dragDistance.current < 5) {
            toggleMinimize();
        }
    };

    const handleApplyCustomTime = (e) => {
        e.preventDefault();
        const mins = parseInt(customMinutes);
        if (mins > 0 && mins <= 120) {
            setTimeLeft(mins * 60);
            setShowSettings(false);
        }
    };


    const getModeLabel = () => {
        if (mode === 'focus') return 'Foco';
        if (mode === 'short') return 'Pausa Curta';
        if (mode === 'long') return 'Pausa Longa';
    };

    const getModeColor = () => {
        if (mode === 'focus') return 'var(--accent-primary)';
        if (mode === 'short') return 'var(--success)';
        if (mode === 'long') return 'var(--info)';
    };

    // Style overrides based on dimensions
    const widgetStyles = {
        left: position.x,
        top: position.y,
        width: isMinimized ? Math.max(140, dimensions.width * 0.45) : dimensions.width,
        height: isMinimized ? 'auto' : dimensions.height,
        cursor: isActuallyDragging ? 'grabbing' : isResizing ? 'nwse-resize' : 'auto',
        transform: isActuallyDragging ? 'scale(1.02)' : 'none',
        transition: isActuallyDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease'
    };

    return (
        <div
            ref={widgetRef}
            className={`pomodoro-widget ${isMinimized ? 'minimized' : ''} ${isDragging ? 'dragging' : ''} animate-scale-in`}
            style={widgetStyles}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onContextMenu={e => e.preventDefault()}
        >
            {/* Header (only in full mode) */}
            {!isMinimized && (
                <div className="pomodoro-header">
                    <div className="pomodoro-drag-handle">
                        <span className="pomodoro-title">{getModeLabel()}</span>
                    </div>
                    <div className="pomodoro-controls-top">
                        <button className="btn-icon-sm" onClick={() => setShowSettings(!showSettings)}>
                            <Settings size={14} />
                        </button>
                        <button className="btn-icon-sm" onClick={toggleMinimize}>
                            <Minimize2 size={14} />
                        </button>
                        <button className="btn-icon-sm" onClick={() => setIsOpen(false)}>
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* Content (hidden when minimized) */}
            {!isMinimized && (
                <div className="pomodoro-content">
                    {showSettings ? (
                        <form className="pomodoro-settings animate-slide-up" onSubmit={handleApplyCustomTime}>
                            <label>Tempo Customizado (min)</label>
                            <div className="custom-time-input">
                                <input
                                    type="number"
                                    value={customMinutes}
                                    onChange={e => setCustomMinutes(e.target.value)}
                                    min="1"
                                    max="120"
                                    autoFocus
                                />
                                <button type="submit" className="btn btn-primary btn-sm">Ok</button>
                            </div>
                            <button type="button" className="btn-text-sm" onClick={() => setShowSettings(false)}>Voltar</button>
                        </form>
                    ) : (
                        <>
                            <div className="pomodoro-timer-display" style={{
                                color: getModeColor(),
                                fontSize: `${Math.max(1.5, dimensions.width / 80)}rem`
                            }}>
                                {formatTime(timeLeft)}
                            </div>

                            <div className="pomodoro-progress-bar">
                                <div
                                    className="pomodoro-progress-fill"
                                    style={{ width: `${progress()}%`, background: getModeColor() }}
                                />
                            </div>

                            <div className="pomodoro-actions">
                                <button
                                    className="btn-circle-lg"
                                    onClick={toggleTimer}
                                    style={{
                                        background: getModeColor(),
                                        width: Math.min(80, dimensions.width / 4),
                                        height: Math.min(80, dimensions.width / 4)
                                    }}
                                >
                                    {isActive ? <Pause size={dimensions.width / 12} fill="white" color="white" /> : <Play size={dimensions.width / 12} fill="white" color="white" />}
                                </button>
                                <button className="btn-circle-md" onClick={resetTimer}>
                                    <RotateCcw size={18} />
                                </button>
                            </div>

                            <div className="pomodoro-modes">
                                <button
                                    className={`mode-btn ${mode === 'focus' ? 'active' : ''}`}
                                    onClick={() => setTimerMode('focus')}
                                >
                                    25
                                </button>
                                <button
                                    className={`mode-btn ${mode === 'short' ? 'active' : ''}`}
                                    onClick={() => setTimerMode('short')}
                                >
                                    5
                                </button>
                                <button
                                    className={`mode-btn ${mode === 'long' ? 'active' : ''}`}
                                    onClick={() => setTimerMode('long')}
                                >
                                    15
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Minimized View - Just the timer pill */}
            {isMinimized && (
                <div className="pomodoro-minimized-content" onClick={handleMinimizedClick}>
                    <span className="minimized-timer" style={{
                        color: getModeColor(),
                        fontSize: `${Math.max(0.8, dimensions.width / 250)}rem`
                    }}>
                        {formatTime(timeLeft)}
                    </span>
                    {isActive && <div className="minimized-active-dot" style={{ background: getModeColor() }} />}
                </div>
            )}

            {/* Resize Handle */}
            <div
                className="pomodoro-resize-handle"
                onMouseDown={handleResizeMouseDown}
            />
        </div>
    );
}
