import { useState, useEffect } from 'react';
import { usePomodoro } from '../../context/PomodoroContext';
import { Play, Pause, RotateCcw, X, Minimize2, Settings } from 'lucide-react';
import './PomodoroTimer.css';

export default function PomodoroTimer() {
    const {
        timeLeft, isActive, mode, isOpen, setIsOpen,
        toggleTimer, resetTimer, setTimerMode, formatTime, progress
    } = usePomodoro();

    const [isMinimized, setIsMinimized] = useState(false);

    if (!isOpen) return null;

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

    return (
        <div className={`pomodoro-widget ${isMinimized ? 'minimized' : ''} animate-scale-in`}>
            {/* Header */}
            <div className="pomodoro-header">
                <span className="pomodoro-title">{getModeLabel()}</span>
                <div className="pomodoro-controls-top">
                    <button className="btn-icon-sm" onClick={() => setIsMinimized(!isMinimized)}>
                        <Minimize2 size={14} />
                    </button>
                    <button className="btn-icon-sm" onClick={() => setIsOpen(false)}>
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Content (hidden when minimized) */}
            {!isMinimized && (
                <div className="pomodoro-content">
                    <div className="pomodoro-timer-display" style={{ color: getModeColor() }}>
                        {formatTime(timeLeft)}
                    </div>

                    <div className="pomodoro-progress-bar">
                        <div
                            className="pomodoro-progress-fill"
                            style={{ width: `${progress()}%`, background: getModeColor() }}
                        />
                    </div>

                    <div className="pomodoro-actions">
                        <button className="btn-circle-lg" onClick={toggleTimer} style={{ background: getModeColor() }}>
                            {isActive ? <Pause size={24} fill="white" color="white" /> : <Play size={24} fill="white" color="white" />}
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
                </div>
            )}

            {/* Minimized View */}
            {isMinimized && (
                <div className="pomodoro-minimized-content">
                    <span style={{ color: getModeColor(), fontWeight: 'bold' }}>{formatTime(timeLeft)}</span>
                    <button className="btn-icon-xs" onClick={toggleTimer}>
                        {isActive ? <Pause size={12} /> : <Play size={12} />}
                    </button>
                </div>
            )}
        </div>
    );
}
