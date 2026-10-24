import { CollabContext } from './useCollab';



export function CollabProvider({ value, children }) {
  return (
    <CollabContext.Provider value={value}>
      {children}
    </CollabContext.Provider>
  );
}


