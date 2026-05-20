import {
  OP_TYPES,
  ENTITIES,
  NODE_TYPES,
  UPDATE_FIELDS,
  BOARD_ACTION_TYPES,
} from './constants.js';

const MAX_JSON_BYTES = 64 * 1024;

function jsonSize(obj) {
  try {
    return JSON.stringify(obj).length;
  } catch {
    return MAX_JSON_BYTES + 1;
  }
}

export function validateOp(op) {
  if (!op || typeof op !== 'object') return 'Invalid op';
  if (!op.opId || typeof op.opId !== 'string') return 'Missing opId';
  if (!OP_TYPES.includes(op.type)) return 'Invalid op type';
  if (!ENTITIES.includes(op.entity)) return 'Invalid entity';

  if (op.type === 'create') {
    if (!op.value || typeof op.value !== 'object') return 'Create requires value';
    if (!op.value.id) return 'Create value requires id';
    if (jsonSize(op.value) > MAX_JSON_BYTES) return 'Payload too large';
    if (op.entity === 'node' && op.value.type && !NODE_TYPES.includes(op.value.type)) {
      return 'Invalid node type';
    }
    return null;
  }

  if (!op.id || typeof op.id !== 'string') return 'Missing entity id';

  if (op.type === 'delete') return null;

  if (op.type === 'update') {
    if (!op.field || !UPDATE_FIELDS.has(op.field)) return 'Invalid update field';
    if (op.value === undefined) return 'Update requires value';
    if (jsonSize(op.value) > MAX_JSON_BYTES) return 'Payload too large';
    if (op.entity === 'board' && op.field === 'action') {
      const action = op.value;
      if (!action?.type || !BOARD_ACTION_TYPES.has(action.type)) return 'Invalid board action';
    }
    return null;
  }

  return 'Unknown op';
}

function optionalId(value) {
  if (value == null) return null;
  if (typeof value !== 'string' || !value.trim()) return 'Invalid id';
  return null;
}

export function validatePresence(payload) {
  if (!payload || typeof payload !== 'object') return 'Invalid presence';
  if (payload.cursor != null) {
    if (typeof payload.cursor.x !== 'number' || typeof payload.cursor.y !== 'number') {
      return 'Invalid cursor';
    }
  }
  if (payload.selectedNodeIds != null && !Array.isArray(payload.selectedNodeIds)) {
    return 'Invalid selectedNodeIds';
  }
  for (const key of [
    'selectedCardId',
    'draggingCardId',
    'draggingListId',
    'hoverCardId',
    'hoverListId',
  ]) {
    const err = optionalId(payload[key]);
    if (err) return err;
  }
  if (payload.cursorScreen != null) {
    if (
      typeof payload.cursorScreen.x !== 'number'
      || typeof payload.cursorScreen.y !== 'number'
    ) {
      return 'Invalid cursorScreen';
    }
  }
  return null;
}
