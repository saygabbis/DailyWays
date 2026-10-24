import { createContext, useContext } from 'react';

export const CollabContext = createContext(null);

export function useCollab() {
  const ctx = useContext(CollabContext);
  return ctx;
}
