import { useSpaceCollabOps } from './useSpaceCollabOps.js';
import { SpaceCollabOpsContext } from './useCollabPatch';



export function SpaceCollabOpsProvider({ children }) {
  const ops = useSpaceCollabOps();
  return (
    <SpaceCollabOpsContext.Provider value={ops}>
      {children}
    </SpaceCollabOpsContext.Provider>
  );
}


