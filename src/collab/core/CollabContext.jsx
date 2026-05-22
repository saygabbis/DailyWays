import { createContext, useContext } from 'react';

const CollabContext = createContext(null);

export function CollabProvider({ value, children }) {
  return (
    <CollabContext.Provider value={value}>
      {children}
    </CollabContext.Provider>
  );
}

export function useCollab() {
  const ctx = useContext(CollabContext);
  return ctx;
}
