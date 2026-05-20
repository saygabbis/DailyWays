/**
 * Maps collab field + value to entity patch for whiteboard store / server state.
 */
export function fieldToPatch(field, value) {
  if (value == null && field !== 'parentId') return {};

  switch (field) {
    case 'position':
      return { x: value.x, y: value.y };
    case 'size':
      return { width: value.width, height: value.height };
    case 'bounds':
      return {
        x: value.x,
        y: value.y,
        width: value.width,
        height: value.height,
      };
    case 'transform':
      return { rotation: value.rotation, scale: value.scale };
    case 'data':
      return { data: value };
    case 'style':
      return { style: value };
    case 'parentId':
      return { parentId: value ?? null };
    case 'zIndex':
      return { zIndex: value };
    case 'controlPoints':
      return { controlPoints: value };
    case 'message':
      return { message: value };
    case 'nodeId':
      return { nodeId: value ?? null };
    case 'x':
      return { x: value };
    case 'y':
      return { y: value };
    case 'type':
      return { type: value };
    default:
      return typeof value === 'object' && !Array.isArray(value) ? value : { [field]: value };
  }
}

/**
 * Infer collab field(s) from a local patch object (may return multiple ops).
 */
export function patchToOps(entity, id, patch) {
  const ops = [];
  if (!patch || typeof patch !== 'object') return ops;

  const keys = Object.keys(patch);
  const hasPos = keys.includes('x') || keys.includes('y');
  const hasSize = keys.includes('width') || keys.includes('height');

  if (hasPos && hasSize && keys.every((k) => ['x', 'y', 'width', 'height'].includes(k))) {
    ops.push({
      type: 'update',
      entity,
      id,
      field: 'bounds',
      value: {
        x: patch.x,
        y: patch.y,
        width: patch.width,
        height: patch.height,
      },
    });
    return ops;
  }

  if (hasPos && keys.every((k) => ['x', 'y'].includes(k))) {
    ops.push({
      type: 'update',
      entity,
      id,
      field: 'position',
      value: { x: patch.x, y: patch.y },
    });
    return ops;
  }

  if (hasSize && keys.every((k) => ['width', 'height'].includes(k))) {
    ops.push({
      type: 'update',
      entity,
      id,
      field: 'size',
      value: { width: patch.width, height: patch.height },
    });
    return ops;
  }

  if (keys.includes('rotation') || keys.includes('scale')) {
    ops.push({
      type: 'update',
      entity,
      id,
      field: 'transform',
      value: { rotation: patch.rotation, scale: patch.scale },
    });
    return ops;
  }

  if (keys.includes('data')) {
    ops.push({ type: 'update', entity, id, field: 'data', value: patch.data });
    return ops;
  }

  if (keys.includes('style')) {
    ops.push({ type: 'update', entity, id, field: 'style', value: patch.style });
    return ops;
  }

  if (keys.includes('parentId')) {
    const rest = { ...patch };
    delete rest.parentId;
    ops.push({ type: 'update', entity, id, field: 'parentId', value: patch.parentId });
    if (Object.keys(rest).length) ops.push(...patchToOps(entity, id, rest));
    return ops;
  }

  if (keys.includes('zIndex')) {
    ops.push({ type: 'update', entity, id, field: 'zIndex', value: patch.zIndex });
    return ops;
  }

  if (keys.includes('controlPoints')) {
    ops.push({ type: 'update', entity, id, field: 'controlPoints', value: patch.controlPoints });
    return ops;
  }

  if (keys.includes('message')) {
    ops.push({ type: 'update', entity, id, field: 'message', value: patch.message });
    return ops;
  }

  for (const k of keys) {
    ops.push({ type: 'update', entity, id, field: k, value: patch[k] });
  }
  return ops;
}

export function applyFieldToEntity(entity, field, value) {
  const patch = fieldToPatch(field, value);
  return { ...entity, ...patch };
}
