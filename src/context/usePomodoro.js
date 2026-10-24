import { createContext, useContext } from 'react';

export const PomodoroContext = createContext();

export function usePomodoro() {
    return useContext(PomodoroContext);
}
