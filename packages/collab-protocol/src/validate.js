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
  if (payload.selectedCardIds != null && !Array.isArray(payload.selectedCardIds)) {
    return 'Invalid selectedCardIds';
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
  if (payload.cursorModal != null) {
    if (
      typeof payload.cursorModal.x !== 'number'
      || typeof payload.cursorModal.y !== 'number'
    ) {
      return 'Invalid cursorModal';
    }
    const region = payload.cursorModal.region;
    if (region !== 'body' && region !== 'sidebar' && region !== 'main') {
      return 'Invalid cursorModal region';
    }
  }
  if (payload.onBoardSurface != null && typeof payload.onBoardSurface !== 'boolean') {
    return 'Invalid onBoardSurface';
  }
  if (payload.hoverModalEl != null) {
    if (typeof payload.hoverModalEl !== 'string' || payload.hoverModalEl.length > 64) {
      return 'Invalid hoverModalEl';
    }
  }
  if (payload.liveDraft != null) {
    if (typeof payload.liveDraft !== 'object') return 'Invalid liveDraft';
    const stringKeys = ['title', 'description', 'priority', 'startDate', 'dueDate', 'recurrenceRule', 'cardColor', 'commentBody'];
    for (const key of stringKeys) {
      if (payload.liveDraft[key] != null && typeof payload.liveDraft[key] !== 'string') {
        return 'Invalid liveDraft field';
      }
      if (typeof payload.liveDraft[key] === 'string' && payload.liveDraft[key].length > 8000) {
        return 'liveDraft too large';
      }
    }
    if (payload.liveDraft.labels != null && !Array.isArray(payload.liveDraft.labels)) {
      return 'Invalid liveDraft labels';
    }
    if (payload.liveDraft.isAllDay != null && typeof payload.liveDraft.isAllDay !== 'boolean') {
      return 'Invalid liveDraft isAllDay';
    }
    if (payload.liveDraft.myDay != null && typeof payload.liveDraft.myDay !== 'boolean') {
      return 'Invalid liveDraft myDay';
    }
  }
  return null;
}
