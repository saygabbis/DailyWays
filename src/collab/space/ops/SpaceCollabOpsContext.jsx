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

export function useSpaceCollabOpsContext() {
  const ctx = useContext(SpaceCollabOpsContext);
  if (!ctx) {
    throw new Error('useSpaceCollabOpsContext must be used within SpaceCollabOpsProvider');
  }
  return ctx;
}

/** Safe fallback when collab is disabled — uses local store only. */
export function useCollabPatch() {
  const ctx = useContext(SpaceCollabOpsContext);
  const store = useWhiteboardStore();
  if (ctx) return ctx;
  return {
    collabPatchNode: store.patchNode,
    collabPatchNodes: (patches) => store.patchNodes(patches),
    collabCreateNode: store.addNode,
    collabDeleteNodes: store.deleteNodes,
    collabCreateConnector: store.addConnector,
    collabDeleteConnector: store.deleteConnector,
    collabPatchConnector: store.patchConnector,
    connected: false,
  };
}
