import { createContext, useContext, useState, useEffect, useRef } from 'react';

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
    const [mode, setMode] = useState('focus'); // focus, short, long
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    // Independent state for each mode
    const [timers, setTimers] = useState({
        focus: { timeLeft: DEFAULT_TIMES.focus, isActive: false },
        short: { timeLeft: DEFAULT_TIMES.short, isActive: false },
        long: { timeLeft: DEFAULT_TIMES.long, isActive: false }
    });

    useEffect(() => {
        const interval = setInterval(() => {
            setTimers(prev => {
                const next = { ...prev };
                let changed = false;

                Object.keys(next).forEach(m => {
                    if (next[m].isActive && next[m].timeLeft > 0) {
                        next[m] = { ...next[m], timeLeft: next[m].timeLeft - 1 };
                        changed = true;
                    } else if (next[m].isActive && next[m].timeLeft === 0) {
                        next[m] = { ...next[m], isActive: false };
                        changed = true;
                        // Alarm sound (only for the current mode or all?)
                        // Play sound only if it just hit zero
                        const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
                        audio.play().catch(e => console.log('Audio play failed', e));
                    }
                });

                return changed ? next : prev;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, []);

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
    };

    const setTimerMode = (newMode) => {
        setMode(newMode);
    };

    const setTimeLeft = (seconds) => {
        setTimers(prev => ({
            ...prev,
            [mode]: { ...prev[mode], timeLeft: seconds }
        }));
    };

    const toggleOpen = () => {
        if (!isOpen) {
            setIsOpen(true);
            setIsMinimized(false);
        } else {
            setIsMinimized(!isMinimized);
        }
    };

    const toggleMinimize = () => setIsMinimized(prev => !prev);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const progress = () => {
        const total = DEFAULT_TIMES[mode];
        return ((total - timers[mode].timeLeft) / total) * 100;
    };

    return (
        <PomodoroContext.Provider value={{
            timeLeft: timers[mode].timeLeft,
            isActive: timers[mode].isActive,
            mode,
            isOpen,
            isMinimized,
            toggleTimer,
            resetTimer,
            setTimerMode,
            setIsOpen,
            setIsMinimized,
            toggleOpen,
            toggleMinimize,
            formatTime,
            progress,
            setTimeLeft
        }}>
            {children}
        </PomodoroContext.Provider>
    );
}
