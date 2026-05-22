import { useCallback, useRef } from 'react';
import { patchToOps, THROTTLE_FIELDS, DEBOUNCE_FIELDS } from '@dailyways/collab-protocol';
import { uuidv4 } from '../../utils/uuid';
import { useWhiteboardStore } from '../../stores/whiteboardStore';
import { useCollab } from '../core/CollabContext.jsx';
import { submitOp } from '../core/collabClient.js';

const THROTTLE_MS = 40;
const DEBOUNCE_MS = 400;

function snapshotEntity(entity, id, state) {
  if (entity === 'node') {
    const n = state.nodes.find((x) => x.id === id);
    return n ? JSON.parse(JSON.stringify(n)) : null;
  }
  if (entity === 'connector') {
    const c = state.connectors.find((x) => x.id === id);
    return c ? JSON.parse(JSON.stringify(c)) : null;
  }
  if (entity === 'comment') {
    const c = state.comments.find((x) => x.id === id);
    return c ? JSON.parse(JSON.stringify(c)) : null;
  }
  return null;
}

export function useCollabOps() {
  const collab = useCollab();
  const throttleTimers = useRef(new Map());
  const debounceTimers = useRef(new Map());
  const pendingThrottleOps = useRef(new Map());

  const sendOp = useCallback(async (baseOp) => {
    const socket = collab?.socket;
    if (!socket?.connected) return;

    const opId = baseOp.opId || uuidv4();
    const state = useWhiteboardStore.getState();
    const snapshot = baseOp.type !== 'create'
      ? snapshotEntity(baseOp.entity, baseOp.id, state)
      : null;

    if (snapshot && baseOp.type === 'update') {
      state.registerPendingOp(opId, baseOp.entity, snapshot);
    }

    const op = {
      ...baseOp,
      opId,
      clientTs: Date.now(),
    };

    try {
      await submitOp(socket, op);
      useWhiteboardStore.getState().clearPendingOp(opId);
    } catch (err) {
      console.warn('[collab] op failed', err.message);
      useWhiteboardStore.getState().rollbackPendingOp(opId);
    }
  }, [collab?.socket]);

  const scheduleOp = useCallback((op) => {
    const field = op.field;
    const key = `${op.entity}:${op.id}:${field || op.type}`;

    if (op.type === 'create' || op.type === 'delete') {
      sendOp(op);
      return;
    }

    if (THROTTLE_FIELDS.has(field)) {
      pendingThrottleOps.current.set(key, op);
      if (throttleTimers.current.has(key)) return;
      const timer = setTimeout(() => {
        throttleTimers.current.delete(key);
        const latest = pendingThrottleOps.current.get(key);
        pendingThrottleOps.current.delete(key);
        if (latest) sendOp(latest);
      }, THROTTLE_MS);
      throttleTimers.current.set(key, timer);
      return;
    }

    if (DEBOUNCE_FIELDS.has(field)) {
      if (debounceTimers.current.has(key)) clearTimeout(debounceTimers.current.get(key));
      const timer = setTimeout(() => {
        debounceTimers.current.delete(key);
        sendOp(op);
      }, DEBOUNCE_MS);
      debounceTimers.current.set(key, timer);
      return;
    }

    sendOp(op);
  }, [sendOp]);

  const emitFromPatch = useCallback((entity, id, patch) => {
    const ops = patchToOps(entity, id, patch);
    for (const op of ops) scheduleOp(op);
  }, [scheduleOp]);

  const collabPatchNode = useCallback((nodeId, patch) => {
    useWhiteboardStore.getState().patchNode(nodeId, patch);
    if (collab?.connected) emitFromPatch('node', nodeId, patch);
  }, [collab?.connected, emitFromPatch]);

  const collabPatchNodes = useCallback((patches) => {
    useWhiteboardStore.getState().patchNodes(patches);
    if (!collab?.connected) return;
    for (const { id, patch } of patches) {
      emitFromPatch('node', id, patch);
    }
  }, [collab?.connected, emitFromPatch]);

  const collabCreateNode = useCallback((node) => {
    useWhiteboardStore.getState().addNode(node);
    if (collab?.connected) {
      scheduleOp({ type: 'create', entity: 'node', value: node });
    }
  }, [collab?.connected, scheduleOp]);

  const collabDeleteNodes = useCallback((ids) => {
    useWhiteboardStore.getState().deleteNodes(ids);
    if (!collab?.connected) return;
    for (const id of ids) {
      scheduleOp({ type: 'delete', entity: 'node', id });
    }
  }, [collab?.connected, scheduleOp]);

  const collabCreateConnector = useCallback((connector) => {
    useWhiteboardStore.getState().addConnector(connector);
    if (collab?.connected) {
      scheduleOp({ type: 'create', entity: 'connector', value: connector });
    }
  }, [collab?.connected, scheduleOp]);

  const collabDeleteConnector = useCallback((connectorId) => {
    useWhiteboardStore.getState().deleteConnector(connectorId);
    if (collab?.connected) {
      scheduleOp({ type: 'delete', entity: 'connector', id: connectorId });
    }
  }, [collab?.connected, scheduleOp]);

  const collabPatchConnector = useCallback((connectorId, patch) => {
    const store = useWhiteboardStore.getState();
    store.patchConnector(connectorId, patch);
    if (collab?.connected) emitFromPatch('connector', connectorId, patch);
  }, [collab?.connected, emitFromPatch]);

  return {
    collabPatchNode,
    collabPatchNodes,
    collabCreateNode,
    collabDeleteNodes,
    collabCreateConnector,
    collabDeleteConnector,
    collabPatchConnector,
    scheduleOp,
    connected: collab?.connected ?? false,
  };
}
