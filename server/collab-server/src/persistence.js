import { supabaseAdmin } from './supabase.js';

function nodeToRow(node, spaceId) {
  return {
    id: node.id,
    space_id: spaceId,
    type: node.type,
    x: node.x ?? 0,
    y: node.y ?? 0,
    width: node.width ?? 100,
    height: node.height ?? 100,
    rotation: node.rotation ?? 0,
    scale: node.scale ?? 1,
    data_json: node.data ?? {},
    style_json: node.style ?? {},
    parent_id: node.parentId ?? null,
    z_index: node.zIndex ?? 0,
    created_by: node.createdBy ?? null,
  };
}

function connectorToRow(conn, spaceId) {
  return {
    id: conn.id,
    space_id: spaceId,
    from_node_id: conn.fromNodeId,
    to_node_id: conn.toNodeId,
    control_points: conn.controlPoints ?? [],
    style_json: conn.style ?? {},
  };
}

function commentToRow(comment, spaceId) {
  return {
    id: comment.id,
    space_id: spaceId,
    node_id: comment.nodeId ?? null,
    x: comment.x ?? null,
    y: comment.y ?? null,
    author_id: comment.authorId,
    message: comment.message,
    parent_id: comment.parentId ?? null,
  };
}

function throwIfDbError(result, context) {
  if (result?.error) {
    throw new Error(`[flushRoom] ${context}: ${result.error.message}`);
  }
}

export async function flushRoom(room, spaceId) {
  if (!supabaseAdmin) return;

  const { dirty, deleted, nodes, connectors, comments } = room;

  for (const id of deleted.nodes) {
    throwIfDbError(
      await supabaseAdmin.from('space_nodes').delete().eq('id', id),
      `delete node ${id}`,
    );
  }
  deleted.nodes.clear();

  for (const id of deleted.connectors) {
    throwIfDbError(
      await supabaseAdmin.from('space_connectors').delete().eq('id', id),
      `delete connector ${id}`,
    );
  }
  deleted.connectors.clear();

  for (const id of deleted.comments) {
    throwIfDbError(
      await supabaseAdmin.from('space_comments').delete().eq('id', id),
      `delete comment ${id}`,
    );
  }
  deleted.comments.clear();

  for (const id of dirty.nodes) {
    const node = nodes.find((n) => n.id === id);
    if (!node) continue;
    const row = nodeToRow(node, spaceId);
    const { data: existing, error: selectErr } = await supabaseAdmin
      .from('space_nodes')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    throwIfDbError(selectErr, `select node ${id}`);
    if (existing) {
      const { x, y, width, height, rotation, scale, data_json, style_json, parent_id, z_index } = row;
      throwIfDbError(
        await supabaseAdmin.from('space_nodes').update({
          x, y, width, height, rotation, scale, data_json, style_json, parent_id, z_index,
        }).eq('id', id),
        `update node ${id}`,
      );
    } else {
      throwIfDbError(
        await supabaseAdmin.from('space_nodes').insert(row),
        `insert node ${id}`,
      );
    }
  }
  dirty.nodes.clear();

  for (const id of dirty.connectors) {
    const conn = connectors.find((c) => c.id === id);
    if (!conn) continue;
    const row = connectorToRow(conn, spaceId);
    const { data: existing, error: selectErr } = await supabaseAdmin
      .from('space_connectors')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    throwIfDbError(selectErr, `select connector ${id}`);
    if (existing) {
      throwIfDbError(
        await supabaseAdmin.from('space_connectors').update({
          control_points: row.control_points,
          style_json: row.style_json,
        }).eq('id', id),
        `update connector ${id}`,
      );
    } else {
      throwIfDbError(
        await supabaseAdmin.from('space_connectors').insert(row),
        `insert connector ${id}`,
      );
    }
  }
  dirty.connectors.clear();

  for (const id of dirty.comments) {
    const comment = comments.find((c) => c.id === id);
    if (!comment) continue;
    const row = commentToRow(comment, spaceId);
    const { data: existing, error: selectErr } = await supabaseAdmin
      .from('space_comments')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    throwIfDbError(selectErr, `select comment ${id}`);
    if (existing) {
      throwIfDbError(
        await supabaseAdmin.from('space_comments').update({
          message: row.message,
          node_id: row.node_id,
          x: row.x,
          y: row.y,
        }).eq('id', id),
        `update comment ${id}`,
      );
    } else {
      throwIfDbError(
        await supabaseAdmin.from('space_comments').insert(row),
        `insert comment ${id}`,
      );
    }
  }
  dirty.comments.clear();
}
