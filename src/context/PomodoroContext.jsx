import { createContext, useContext, useState, useEffect, useRef } from 'react';

const PomodoroContext = createContext();

export function usePomodoro() {
    return useContext(PomodoroContext);
}

export function PomodoroProvider({ children }) {
    const [timeLeft, setTimeLeft] = useState(25 * 60);
    const [isActive, setIsActive] = useState(false);
    const [mode, setMode] = useState('focus'); // focus, short, long
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        let interval = null;
        if (isActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(timeLeft => timeLeft - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            setIsActive(false);
            // Play sound or notification here
            const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
            audio.play().catch(e => console.log('Audio play failed', e));
        }
        return () => clearInterval(interval);
    }, [isActive, timeLeft]);

    const toggleTimer = () => setIsActive(!isActive);

    const resetTimer = () => {
        setIsActive(false);
        if (mode === 'focus') setTimeLeft(25 * 60);
        if (mode === 'short') setTimeLeft(5 * 60);
        if (mode === 'long') setTimeLeft(15 * 60);
    };

    const setTimerMode = (newMode) => {
        setMode(newMode);
        setIsActive(false);
        if (newMode === 'focus') setTimeLeft(25 * 60);
        if (newMode === 'short') setTimeLeft(5 * 60);
        if (newMode === 'long') setTimeLeft(15 * 60);
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const progress = () => {
        const total = mode === 'focus' ? 25 * 60 : mode === 'short' ? 5 * 60 : 15 * 60;
        return ((total - timeLeft) / total) * 100;
    };

    return (
        <PomodoroContext.Provider value={{
            timeLeft, isActive, mode, isOpen,
            toggleTimer, resetTimer, setTimerMode, setIsOpen,
            formatTime, progress
        }}>
            {children}
        </PomodoroContext.Provider>
    );
}
