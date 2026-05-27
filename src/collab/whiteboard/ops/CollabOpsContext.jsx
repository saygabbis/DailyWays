import { createContext, useContext } from 'react';
import { useWhiteboardStore } from '../../../stores/whiteboardStore';
import { useCollabOps } from './useCollabOps.js';

const CollabOpsContext = createContext(null);

export function CollabOpsProvider({ children }) {
  const ops = useCollabOps();
  return (
    <CollabOpsContext.Provider value={ops}>
      {children}
    </CollabOpsContext.Provider>
  );
}

export function useCollabOpsContext() {
  const ctx = useContext(CollabOpsContext);
  if (!ctx) {
    throw new Error('useCollabOpsContext must be used within CollabOpsProvider');
  }
  return ctx;
}

/** Safe fallback when collab is disabled — uses local store only. */
export function useCollabPatch() {
  const ctx = useContext(CollabOpsContext);
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
