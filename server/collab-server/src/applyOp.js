import { applyFieldToEntity } from '@dailyways/collab-protocol';

export function applyOpToRoom(room, op) {
  const { type, entity, id, field, value } = op;

  if (type === 'create') {
    const item = { ...value };
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
      room.nodes[idx] = applyFieldToEntity(room.nodes[idx], field, value);
      room.dirty.nodes.add(id);
    } else if (entity === 'connector') {
      const idx = room.connectors.findIndex((c) => c.id === id);
      if (idx < 0) return { ok: false, reason: 'Connector not found' };
      room.connectors[idx] = applyFieldToEntity(room.connectors[idx], field, value);
      room.dirty.connectors.add(id);
    } else if (entity === 'comment') {
      const idx = room.comments.findIndex((c) => c.id === id);
      if (idx < 0) return { ok: false, reason: 'Comment not found' };
      room.comments[idx] = applyFieldToEntity(room.comments[idx], field, value);
      room.dirty.comments.add(id);
    } else {
      return { ok: false, reason: 'Unknown entity' };
    }
    room.revision += 1;
    return { ok: true };
  }

  return { ok: false, reason: 'Unknown op type' };
}
