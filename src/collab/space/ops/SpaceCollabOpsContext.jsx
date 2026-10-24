import { createContext, useContext } from 'react';
import { useWhiteboardStore } from '../../../stores/whiteboardStore';
import { useSpaceCollabOps } from './useSpaceCollabOps.js';

const SpaceCollabOpsContext = createContext(null);

export function SpaceCollabOpsProvider({ children }) {
  const ops = useSpaceCollabOps();
  return (
    <SpaceCollabOpsContext.Provider value={ops}>
      {children}
    </SpaceCollabOpsContext.Provider>
  );
}

/** Safe fallback when collab is disabled — uses local store only. */
export function useCollabPatch() {
  const ctx = useContext(SpaceCollabOpsContext);
  const store = useWhiteboardStore();
  if (ctx) return ctx;
  return {
    collabPatchNode: store.patchNode,
    collabPatchNodes: (patches) => store.patchNodes(patches),
    collabEmitNodeOps: () => {},
    collabCreateNode: store.addNode,
    collabDeleteNodes: store.deleteNodes,
    collabCreateConnector: store.addConnector,
    collabDeleteConnector: store.deleteConnector,
    collabPatchConnector: store.patchConnector,
    connected: false,
  };
}
