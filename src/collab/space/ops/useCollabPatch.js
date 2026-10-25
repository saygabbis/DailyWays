import { createContext, useContext } from 'react';
import { useWhiteboardStore } from '../../../stores/whiteboardStore';

export const SpaceCollabOpsContext = createContext(null);

/** Safe fallback when collab is disabled — uses local store only. */
export function useCollabPatch() {
  const ctx = useContext(SpaceCollabOpsContext);
  if (ctx) return ctx;
  // as ações do store são estáveis: ler sem assinar (antes re-renderizava a cada mudança do canvas)
  const store = useWhiteboardStore.getState();
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
