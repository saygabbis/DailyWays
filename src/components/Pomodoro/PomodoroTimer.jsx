import { useState, useEffect, useRef, useCallback } from 'react';
import { usePomodoro } from '../../context/PomodoroContext';
import { Play, Pause, RotateCcw, X, Minimize2, Settings } from 'lucide-react';
import './PomodoroTimer.css';

const DEFAULT_SIZE = { width: 280, height: null }; // height null = auto
const DEFAULT_MINI_SIZE = { width: 120, height: 60 };
const DEFAULT_POS = () => ({ x: window.innerWidth - 320, y: window.innerHeight - 380 });

export default function PomodoroTimer() {
    const {
        timeLeft, isActive, mode, isOpen, isMinimized, setIsOpen,
        toggleTimer, resetTimer, setTimerMode, formatTime, progress,
        toggleMinimize, setTimeLeft
    } = usePomodoro();

    const [showSettings, setShowSettings] = useState(false);
    const [customMinutes, setCustomMinutes] = useState('25');
    const [position, setPosition] = useState(DEFAULT_POS);
    const [size, setSize] = useState(DEFAULT_SIZE);     // full mode
    const [miniSize, setMiniSize] = useState(DEFAULT_MINI_SIZE);    // minimized mode

    useEffect(() => {
        if (isOpen) {
            setPosition(DEFAULT_POS());
            setSize(DEFAULT_SIZE);
            setMiniSize(DEFAULT_MINI_SIZE);
        }
    }, [isOpen]);

    // Drag ──────────────────────────────────────────────────────────────────
    const [isDragging, setIsDragging] = useState(false);
    const [isActuallyDragging, setIsActuallyDragging] = useState(false);
    const dragDistance = useRef(0);
    const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

    // Resize ────────────────────────────────────────────────────────────────
    const [resizeDir, setResizeDir] = useState(null); // 'e'|'s'|'se'
    const resizeStart = useRef({ width: 0, height: 0, mouseX: 0, mouseY: 0 });

    const widgetRef = useRef(null);

    const handleMouseDownDrag = useCallback((e) => {
        e.preventDefault();
        dragDistance.current = 0;
        dragStart.current = { x: e.clientX, y: e.clientY, posX: position.x, posY: position.y };
        setIsDragging(true);
    }, [position]);

    const startResize = useCallback((dir) => (e) => {
        e.preventDefault();
        e.stopPropagation();
        const el = widgetRef.current;
        const currentW = el?.offsetWidth || (isMinimized ? miniSize.width : size.width || 280);
        const currentH = el?.offsetHeight || (isMinimized ? miniSize.height : size.height || 300);
        resizeStart.current = { width: currentW, height: currentH, mouseX: e.clientX, mouseY: e.clientY };
        // Anchor height when starting vertical resize on full mode
        if (!isMinimized && dir.includes('s')) {
            setSize(prev => ({ ...prev, height: currentH }));
        }
        setResizeDir(dir);
    }, [isMinimized, miniSize, size]);

    useEffect(() => {
        const onMove = (e) => {
            // Drag
            if (isDragging && !resizeDir) {
                const dx = e.clientX - dragStart.current.x;
                const dy = e.clientY - dragStart.current.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 3 || isActuallyDragging) {
                    if (!isActuallyDragging) setIsActuallyDragging(true);
                    dragDistance.current = dist;
                    const pad = 10;
                    const el = widgetRef.current;
                    const w = el?.offsetWidth || 280;
                    const h = el?.offsetHeight || 200;
                    setPosition({
                        x: Math.max(pad, Math.min(dragStart.current.posX + dx, window.innerWidth - w - pad)),
                        y: Math.max(pad, Math.min(dragStart.current.posY + dy, window.innerHeight - h - pad)),
                    });
                }
            }
            // Resize
            if (resizeDir) {
                const dx = e.clientX - resizeStart.current.mouseX;
                const dy = e.clientY - resizeStart.current.mouseY;

                // Uniform delta: any movement (right or down) scales it up
                // Using Math.max(dx, dy) makes it feel responsive to both axes
                const delta = Math.max(dx, dy);

                if (isMinimized) {
                    setMiniSize(prev => {
                        const ratio = resizeStart.current.width / resizeStart.current.height;
                        // Lower min width to 80 for more range
                        const newW = Math.min(450, Math.max(80, resizeStart.current.width + delta));

                        // Keep it rounder by default (ratio closer to 2)
                        const targetRatio = Math.max(1.8, Math.min(2.4, ratio + delta / 500));

                        return { width: newW, height: newW / targetRatio };
                    });
                } else {
                    setSize(prev => {
                        const newW = Math.min(480, Math.max(200, resizeStart.current.width + delta));
                        return { width: newW };
                    });
                }
            }
        };
        const onUp = () => { setIsDragging(false); setIsActuallyDragging(false); setResizeDir(null); };
        if (isDragging || resizeDir) {
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        }
        return () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
    }, [isDragging, isActuallyDragging, resizeDir, isMinimized]);

    if (!isOpen) return null;

    const handleMinimizedClick = () => { if (dragDistance.current < 5) toggleMinimize(); };
    const w = size.width || 280;
    const isCompact = w < 250;
    const timerFontSize = Math.min(3.5, Math.max(1.8, w / 90));
    const btnSize = Math.min(64, w / 4.5);

    const getModeLabel = () => mode === 'focus' ? 'Foco' : mode === 'short' ? 'Pausa Curta' : 'Pausa Longa';
    const getModeColor = () => mode === 'focus' ? 'var(--accent-primary)' : mode === 'short' ? 'var(--success)' : 'var(--info)';

    const handleApplyCustomTime = (e) => {
        e.preventDefault();
        const mins = parseInt(customMinutes);
        if (mins > 0 && mins <= 120) { setTimeLeft(mins * 60); setShowSettings(false); }
    };

    const cursorStyle = isActuallyDragging ? 'grabbing'
        : resizeDir === 'e' ? 'ew-resize'
            : resizeDir === 's' ? 'ns-resize'
                : resizeDir === 'se' ? 'nwse-resize'
                    : 'auto';

    const widgetStyle = isMinimized
        ? {
            left: position.x,
            top: position.y,
            width: miniSize.width,
            height: miniSize.height,
            cursor: cursorStyle,
        }
        : {
            left: position.x,
            top: position.y,
            width: size.width,
            height: size.height ?? undefined, // undefined = auto
            cursor: cursorStyle,
            transform: isActuallyDragging ? 'scale(1.02)' : 'none',
            transition: isActuallyDragging || resizeDir ? 'none' : 'transform 0.25s ease, box-shadow 0.25s ease',
        };

    return (
        <div
            ref={widgetRef}
            className={`pomodoro-widget ${isMinimized ? 'minimized' : ''} ${isDragging ? 'dragging' : ''} ${resizeDir ? 'resizing' : ''} animate-scale-in`}
            style={widgetStyle}
            onContextMenu={e => e.preventDefault()}
        >
            {/* ── Full mode ───────────────────────────────────────────────── */}
            {!isMinimized && (
                <>
                    <div className="pomodoro-header" onMouseDown={handleMouseDownDrag}>
                        <div className="pomodoro-drag-handle">
                            <span className="pomodoro-title">{getModeLabel()}</span>
                        </div>
                        <div className="pomodoro-controls-top">
                            <button className="btn-icon-sm" onClick={() => setShowSettings(s => !s)}>
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

                    <div className={`pomodoro-content ${isCompact ? 'compact' : ''}`}>
                        {showSettings ? (
                            <form className="pomodoro-settings animate-slide-up" onSubmit={handleApplyCustomTime}>
                                <label>Tempo (min)</label>
                                <div className="custom-time-input">
                                    <input
                                        type="number" value={customMinutes}
                                        onChange={e => setCustomMinutes(e.target.value)}
                                        min="1" max="120" autoFocus
                                    />
                                    <button type="submit" className="btn btn-primary btn-sm">Ok</button>
                                </div>
                                <button type="button" className="btn-text-sm" onClick={() => setShowSettings(false)}>Voltar</button>
                            </form>
                        ) : (
                            <>
                                <div
                                    className="pomodoro-timer-display"
                                    style={{ color: getModeColor(), fontSize: `${timerFontSize}rem` }}
                                >
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
                                        style={{ background: getModeColor(), width: btnSize, height: btnSize }}
                                    >
                                        {isActive
                                            ? <Pause size={btnSize / 2.5} fill="white" color="white" />
                                            : <Play size={btnSize / 2.5} fill="white" color="white" />}
                                    </button>
                                    <button className="btn-circle-md" onClick={resetTimer}>
                                        <RotateCcw size={16} />
                                    </button>
                                </div>

                                <div className="pomodoro-modes">
                                    {[['focus', '25'], ['short', '5'], ['long', '15']].map(([m, label]) => (
                                        <button
                                            key={m}
                                            className={`mode-btn ${mode === m ? 'active' : ''}`}
                                            onClick={() => setTimerMode(m)}
                                        >{label}</button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* 3 resize handles */}
                    <div className="pomodoro-resize-e" onMouseDown={startResize('e')} />
                    <div className="pomodoro-resize-s" onMouseDown={startResize('s')} />
                    <div className="pomodoro-resize-se" onMouseDown={startResize('se')} />
                </>
            )}

            {/* ── Minimized pill ──────────────────────────────────────────── */}
            {isMinimized && (
                <>
                    <div
                        className="pomodoro-minimized-content"
                        onMouseDown={handleMouseDownDrag}
                        onClick={handleMinimizedClick}
                    >
                        <span
                            className="minimized-timer"
                            style={{
                                color: getModeColor(),
                                fontSize: `${Math.max(1.2, Math.min(miniSize.width / 75, miniSize.height / 24))}rem`,
                                fontWeight: '600'
                            }}
                        >
                            {formatTime(timeLeft)}
                        </span>
                        {isActive && <div className="minimized-active-dot" style={{ background: getModeColor() }} />}
                    </div>
                    {/* Minimized also gets resize handles */}
                    <div className="pomodoro-resize-e" onMouseDown={startResize('e')} />
                    <div className="pomodoro-resize-s" onMouseDown={startResize('s')} />
                    <div className="pomodoro-resize-se" onMouseDown={startResize('se')} />
                </>
            )}
        </div>
    );
}
