import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { recordFocusSeconds } from '../services/dailyProgressService';
import { DEFAULT_FOCUS_MINUTES, TIMEZONE_FALLBACK } from '../components/MyDay/hub/diaryHubConfig';

const PomodoroContext = createContext();

export function usePomodoro() {
    return useContext(PomodoroContext);
}

const DEFAULT_TIMES = {
    focus: 25 * 60,
    short: 5 * 60,
    long: 15 * 60
};

export function PomodoroProvider({ children }) {
    const { user } = useAuth();
    const [mode, setMode] = useState('focus');
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [linkedCardId, setLinkedCardId] = useState(null);
    const [linkedCardTitle, setLinkedCardTitle] = useState(null);

    const focusSessionRef = useRef({ duration: DEFAULT_TIMES.focus, recorded: false });

    const [timers, setTimers] = useState({
        focus: { timeLeft: DEFAULT_TIMES.focus, isActive: false },
        short: { timeLeft: DEFAULT_TIMES.short, isActive: false },
        long: { timeLeft: DEFAULT_TIMES.long, isActive: false }
    });

    const timezone = user?.timezone || TIMEZONE_FALLBACK;
    const userIdRef = useRef(user?.id);
    userIdRef.current = user?.id;

    const handleFocusSessionComplete = useCallback(async (durationSeconds) => {
        if (focusSessionRef.current.recorded || !userIdRef.current) return;
        focusSessionRef.current.recorded = true;
        await recordFocusSeconds(userIdRef.current, durationSeconds, timezone);
        window.dispatchEvent(new CustomEvent('diary-focus-complete'));
    }, [timezone]);

    useEffect(() => {
        const interval = setInterval(() => {
            setTimers(prev => {
                const next = { ...prev };
                let changed = false;
                let focusJustFinished = false;

                Object.keys(next).forEach(m => {
                    if (next[m].isActive && next[m].timeLeft > 0) {
                        next[m] = { ...next[m], timeLeft: next[m].timeLeft - 1 };
                        changed = true;
                    } else if (next[m].isActive && next[m].timeLeft === 0) {
                        next[m] = { ...next[m], isActive: false };
                        changed = true;
                        if (m === 'focus') focusJustFinished = true;
                        const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
                        audio.play().catch(() => {});
                    }
                });

                if (focusJustFinished) {
                    handleFocusSessionComplete(focusSessionRef.current.duration);
                }

                return changed ? next : prev;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [handleFocusSessionComplete]);

    const toggleTimer = () => {
        setTimers(prev => ({
            ...prev,
            [mode]: { ...prev[mode], isActive: !prev[mode].isActive }
        }));
    };

    const resetTimer = () => {
        setTimers(prev => ({
            ...prev,
            [mode]: { timeLeft: DEFAULT_TIMES[mode], isActive: false }
        }));
        if (mode === 'focus') {
            focusSessionRef.current = { duration: DEFAULT_TIMES.focus, recorded: false };
        }
    };

    const setTimerMode = (newMode) => {
        setMode(newMode);
    };

    const setTimeLeft = (seconds) => {
        setTimers(prev => ({
            ...prev,
            [mode]: { ...prev[mode], timeLeft: seconds }
        }));
        if (mode === 'focus') {
            focusSessionRef.current.duration = seconds;
        }
    };

    const startFocusForCard = (card, minutes) => {
        const mins = minutes ?? card?.estimatedMinutes ?? DEFAULT_FOCUS_MINUTES;
        const seconds = Math.max(60, mins * 60);
        setLinkedCardId(card?.id ?? null);
        setLinkedCardTitle(card?.title ?? null);
        setMode('focus');
        focusSessionRef.current = { duration: seconds, recorded: false };
        setTimers(prev => ({
            ...prev,
            focus: { timeLeft: seconds, isActive: true },
        }));
        setIsOpen(true);
        setIsMinimized(false);
    };

    const clearLinkedCard = () => {
        setLinkedCardId(null);
        setLinkedCardTitle(null);
    };

    const toggleOpen = () => {
        if (!isOpen) {
            setIsOpen(true);
            setIsMinimized(false);
        } else {
            const anyRunning = Object.values(timers).some(t => t.isActive);
            if (anyRunning) {
                setIsMinimized(prev => !prev);
            } else {
                setIsOpen(false);
                setIsMinimized(false);
            }
        }
    };

    const toggleMinimize = () => setIsMinimized(prev => !prev);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const progress = () => {
        const total = focusSessionRef.current.duration || DEFAULT_TIMES[mode];
        if (mode === 'focus' && linkedCardId) {
            return ((total - timers.focus.timeLeft) / total) * 100;
        }
        return ((DEFAULT_TIMES[mode] - timers[mode].timeLeft) / DEFAULT_TIMES[mode]) * 100;
    };

    return (
        <PomodoroContext.Provider value={{
            timeLeft: timers[mode].timeLeft,
            isActive: timers[mode].isActive,
            mode,
            isOpen,
            isMinimized,
            linkedCardId,
            linkedCardTitle,
            toggleTimer,
            resetTimer,
            setTimerMode,
            setIsOpen,
            setIsMinimized,
            toggleOpen,
            toggleMinimize,
            formatTime,
            progress,
            setTimeLeft,
            startFocusForCard,
            clearLinkedCard,
        }}>
            {children}
        </PomodoroContext.Provider>
    );
}
