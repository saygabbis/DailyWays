import { createContext, useContext } from 'react';

export const RadioContext = createContext();

export function useRadio() {
    return useContext(RadioContext);
}
