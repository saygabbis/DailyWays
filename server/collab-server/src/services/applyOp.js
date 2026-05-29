import { applyFieldToEntity } from '@dailyways/collab-protocol';

function stampCreateValue(entity, value, userId) {
  if (!userId || !value || typeof value !== 'object') return value;
  if (entity === 'comment') {
    return { ...value, authorId: userId };
  }
  if (entity === 'node') {
    return { ...value, createdBy: userId };
  }
  return value;
}

export function applyOpToRoom(room, op, { userId } = {}) {
  const { type, entity, id, field, value } = op;

  if (type === 'create') {
    const item = stampCreateValue(entity, { ...value }, userId);
    if (entity === 'node') {
      if (room.nodes.some((n) => n.id === item.id)) return { ok: false, reason: 'Node already exists' };
      room.nodes.push(item);
      room.dirty.nodes.add(item.id);
    } else if (entity === 'connector') {
      if (room.connectors.some((c) => c.id === item.id)) return { ok: false, reason: 'Connector exists' };
      room.connectors.push(item);
      room.dirty.connectors.add(item.id);
    } else if (entity === 'comment') {
      if (room.comments.some((c) => c.id === item.id)) return { ok: false, reason: 'Comment exists' };
      room.comments.push(item);
      room.dirty.comments.add(item.id);
    }
    room.revision += 1;
    return { ok: true };
  }

  if (type === 'delete') {
    if (entity === 'node') {
      const before = room.nodes.length;
      room.nodes = room.nodes.filter((n) => n.id !== id);
      if (room.nodes.length === before) return { ok: false, reason: 'Node not found' };
      room.deleted.nodes.add(id);
      room.dirty.nodes.delete(id);
    } else if (entity === 'connector') {
      const before = room.connectors.length;
      room.connectors = room.connectors.filter((c) => c.id !== id);
      if (room.connectors.length === before) return { ok: false, reason: 'Connector not found' };
      room.deleted.connectors.add(id);
      room.dirty.connectors.delete(id);
    } else if (entity === 'comment') {
      const before = room.comments.length;
      room.comments = room.comments.filter((c) => c.id !== id);
      if (room.comments.length === before) return { ok: false, reason: 'Comment not found' };
      room.deleted.comments.add(id);
      room.dirty.comments.delete(id);
    }
    room.revision += 1;
    return { ok: true };
  }

  if (type === 'update') {
    if (entity === 'node') {
      const idx = room.nodes.findIndex((n) => n.id === id);
      if (idx < 0) return { ok: false, reason: 'Node not found' };
      let next = applyFieldToEntity(room.nodes[idx], field, value);
      if (userId && field === 'data' && next?.data) {
        next = { ...next, createdBy: room.nodes[idx].createdBy ?? userId };
      }
      room.nodes[idx] = next;
      room.dirty.nodes.add(id);
    } else if (entity === 'connector') {
      const idx = room.connectors.findIndex((c) => c.id === id);
      if (idx < 0) return { ok: false, reason: 'Connector not found' };
      room.connectors[idx] = applyFieldToEntity(room.connectors[idx], field, value);
      room.dirty.connectors.add(id);
    } else if (entity === 'comment') {
      const idx = room.comments.findIndex((c) => c.id === id);
      if (idx < 0) return { ok: false, reason: 'Comment not found' };
      const patched = applyFieldToEntity(room.comments[idx], field, value);
      room.comments[idx] = userId
        ? { ...patched, authorId: room.comments[idx].authorId ?? userId }
        : patched;
      room.dirty.comments.add(id);
    } else {
      return { ok: false, reason: 'Unknown entity' };
    }
    room.revision += 1;
    return { ok: true };
  }

  return { ok: false, reason: 'Unknown op type' };
}
