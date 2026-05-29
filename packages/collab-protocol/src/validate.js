import {
  OP_TYPES,
  ENTITIES,
  NODE_TYPES,
  UPDATE_FIELDS,
  BOARD_ACTION_TYPES,
} from './constants.js';
import {
  COLLAB_MAX_JSON_BYTES,
  TEXT,
  LIVE_DRAFT_MAX,
  validateLiveDraftField,
  validateCardTitle,
  validateWhiteboardNodeText,
} from '@dailyways/limits';

const MAX_JSON_BYTES = COLLAB_MAX_JSON_BYTES;

function jsonSize(obj) {
  try {
    return JSON.stringify(obj).length;
  } catch {
    return MAX_JSON_BYTES + 1;
  }
}

function validateBoardAction(action) {
  if (!action?.type || !BOARD_ACTION_TYPES.has(action.type)) return 'Invalid board action';
  const p = action.payload || {};

  switch (action.type) {
    case 'ADD_CARD':
    case 'UPDATE_CARD': {
      const title = p.title ?? p.updates?.title;
      if (title != null) {
        const r = validateCardTitle(title);
        if (!r.ok) return 'Card title too large';
      }
      const desc = p.updates?.description;
      if (desc != null && desc.length > TEXT.cardDescription) return 'Card description too large';
      if (p.updates?.labels != null && Array.isArray(p.updates.labels) && p.updates.labels.length > 15) {
        return 'Too many card labels';
      }
      break;
    }
    case 'ADD_LIST':
    case 'UPDATE_LIST': {
      const title = p.title ?? p.updates?.title;
      if (title != null && title.length > TEXT.listTitle) return 'List title too large';
      break;
    }
    case 'UPDATE_BOARD': {
      const title = p.updates?.title;
      if (title != null && title.length > TEXT.boardTitle) return 'Board title too large';
      break;
    }
    case 'ADD_SUBTASK':
    case 'UPDATE_SUBTASK': {
      const title = p.title ?? p.updates?.title;
      if (title != null && title.length > TEXT.subtaskTitle) return 'Subtask title too large';
      break;
    }
    default:
      break;
  }
  return null;
}

function validateNodeValue(value) {
  if (!value?.type) return null;
  const text = value.data?.text ?? value.data?.label;
  if (text != null && typeof text === 'string') {
    const r = validateWhiteboardNodeText(text);
    if (!r.ok) return 'Node text too large';
  }
  const filename = value.data?.filename;
  if (filename != null && filename.length > 255) return 'Filename too large';
  return null;
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
    if (op.entity === 'node') {
      const err = validateNodeValue(op.value);
      if (err) return err;
    }
    if (op.entity === 'comment') {
      const msg = op.value.message ?? op.value.body;
      if (msg != null && msg.length > TEXT.cardComment) return 'Comment too large';
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
      return validateBoardAction(op.value) || null;
    }
    if (op.entity === 'node' && (op.field === 'data' || op.field === 'message')) {
      const merged = typeof op.value === 'object' ? op.value : {};
      const text = merged.text ?? merged.message;
      if (text != null) {
        const r = validateWhiteboardNodeText(text);
        if (!r.ok) return 'Node text too large';
      }
    }
    if (op.entity === 'comment') {
      const msg = typeof op.value === 'string' ? op.value : op.value?.message;
      if (msg != null && msg.length > TEXT.cardComment) return 'Comment too large';
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
  if (payload.draggingNodeIds != null && !Array.isArray(payload.draggingNodeIds)) {
    return 'Invalid draggingNodeIds';
  }
  if (payload.dragPreviewRects != null) {
    if (!Array.isArray(payload.dragPreviewRects)) return 'Invalid dragPreviewRects';
    for (const rect of payload.dragPreviewRects) {
      if (!rect || typeof rect !== 'object') return 'Invalid dragPreviewRect';
      if (
        typeof rect.x !== 'number'
        || typeof rect.y !== 'number'
        || typeof rect.width !== 'number'
        || typeof rect.height !== 'number'
      ) {
        return 'Invalid dragPreviewRect';
      }
    }
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
    if (typeof payload.hoverModalEl !== 'string' || payload.hoverModalEl.length > TEXT.hoverModalEl) {
      return 'Invalid hoverModalEl';
    }
  }
  if (payload.liveDraft != null) {
    if (typeof payload.liveDraft !== 'object') return 'Invalid liveDraft';
    for (const key of Object.keys(LIVE_DRAFT_MAX)) {
      const v = payload.liveDraft[key];
      if (v == null) continue;
      const r = validateLiveDraftField(key, v);
      if (!r.ok) return 'liveDraft too large';
    }
    if (payload.liveDraft.labels != null && !Array.isArray(payload.liveDraft.labels)) {
      return 'Invalid liveDraft labels';
    }
    if (payload.liveDraft.labels?.length > 15) return 'liveDraft labels too many';
    if (payload.liveDraft.isAllDay != null && typeof payload.liveDraft.isAllDay !== 'boolean') {
      return 'Invalid liveDraft isAllDay';
    }
    if (payload.liveDraft.myDay != null && typeof payload.liveDraft.myDay !== 'boolean') {
      return 'Invalid liveDraft myDay';
    }
  }
  return null;
}
