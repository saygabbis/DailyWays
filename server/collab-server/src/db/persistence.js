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
  const error = result?.error ?? result;
  if (error) {
    throw new Error(`[flushRoom] ${context}: ${error.message}`);
  }
}

export async function flushRoom(room, spaceId) {
  if (!supabaseAdmin) return;

  const { dirty, deleted, nodes, connectors, comments } = room;
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const connectorsById = new Map(connectors.map((conn) => [conn.id, conn]));
  const commentsById = new Map(comments.map((comment) => [comment.id, comment]));

  const deletedNodeIds = [...deleted.nodes];
  if (deletedNodeIds.length > 0) {
    throwIfDbError(
      await supabaseAdmin.from('space_nodes').delete().in('id', deletedNodeIds),
      `delete ${deletedNodeIds.length} nodes`,
    );
  }
  deleted.nodes.clear();

  const deletedConnectorIds = [...deleted.connectors];
  if (deletedConnectorIds.length > 0) {
    throwIfDbError(
      await supabaseAdmin.from('space_connectors').delete().in('id', deletedConnectorIds),
      `delete ${deletedConnectorIds.length} connectors`,
    );
  }
  deleted.connectors.clear();

  const deletedCommentIds = [...deleted.comments];
  if (deletedCommentIds.length > 0) {
    throwIfDbError(
      await supabaseAdmin.from('space_comments').delete().in('id', deletedCommentIds),
      `delete ${deletedCommentIds.length} comments`,
    );
  }
  deleted.comments.clear();

  const nodeRows = [];
  for (const id of dirty.nodes) {
    const node = nodesById.get(id);
    if (!node) continue;
    nodeRows.push(nodeToRow(node, spaceId));
  }
  if (nodeRows.length > 0) {
    throwIfDbError(
      await supabaseAdmin.from('space_nodes').upsert(nodeRows, { onConflict: 'id' }),
      `upsert ${nodeRows.length} nodes`,
    );
  }
  dirty.nodes.clear();

  const connectorRows = [];
  for (const id of dirty.connectors) {
    const conn = connectorsById.get(id);
    if (!conn) continue;
    connectorRows.push(connectorToRow(conn, spaceId));
  }
  if (connectorRows.length > 0) {
    throwIfDbError(
      await supabaseAdmin.from('space_connectors').upsert(connectorRows, { onConflict: 'id' }),
      `upsert ${connectorRows.length} connectors`,
    );
  }
  dirty.connectors.clear();

  const commentRows = [];
  for (const id of dirty.comments) {
    const comment = commentsById.get(id);
    if (!comment) continue;
    commentRows.push(commentToRow(comment, spaceId));
  }
  if (commentRows.length > 0) {
    throwIfDbError(
      await supabaseAdmin.from('space_comments').upsert(commentRows, { onConflict: 'id' }),
      `upsert ${commentRows.length} comments`,
    );
  }
  dirty.comments.clear();
}
