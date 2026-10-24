import { getUserDbClient } from './supabase.js';

function nodeToRow(node, spaceId, actingUserId) {
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
    created_by: actingUserId ?? node.createdBy ?? null,
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

function commentToRow(comment, spaceId, actingUserId) {
  return {
    id: comment.id,
    space_id: spaceId,
    node_id: comment.nodeId ?? null,
    x: comment.x ?? null,
    y: comment.y ?? null,
    author_id: actingUserId ?? comment.authorId,
    message: comment.message,
    parent_id: comment.parentId ?? null,
  };
}

function throwIfDbError(result, context) {
  const pgError = result?.error ?? null;
  if (pgError) {
    const detail = pgError.message || pgError.code || pgError.details || JSON.stringify(pgError);
    throw new Error(`[flushRoom] ${context}: ${detail}`);
  }
}

/** Esvazia um Set e devolve o conteúdo (o que chegar depois entra no próximo flush). */
function drain(set) {
  const items = [...set];
  set.clear();
  return items;
}

export async function flushRoom(room, spaceId) {
  const accessToken = room?.flushAccessToken;
  const db = getUserDbClient(accessToken);
  if (!db) {
    throw new Error('[flushRoom] missing user access token (RLS)');
  }

  const actingUserId = room.flushUserId ?? null;
  const { dirty, deleted, nodes, connectors, comments } = room;

  // Retrato do que está pendente, tirado ANTES de qualquer await. Antes os Sets eram limpos
  // depois de gravar, então uma alteração que chegasse durante a gravação era apagada da fila
  // sem nunca ir para o banco (edições sumindo no Spaces).
  const pending = {
    deletedNodes: drain(deleted.nodes),
    deletedConnectors: drain(deleted.connectors),
    deletedComments: drain(deleted.comments),
    dirtyNodes: drain(dirty.nodes),
    dirtyConnectors: drain(dirty.connectors),
    dirtyComments: drain(dirty.comments),
  };
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const connectorsById = new Map(connectors.map((conn) => [conn.id, conn]));
  const commentsById = new Map(comments.map((comment) => [comment.id, comment]));

  const nodeRows = pending.dirtyNodes
    .map((id) => nodesById.get(id))
    .filter(Boolean)
    .map((node) => nodeToRow(node, spaceId, actingUserId));
  const connectorRows = pending.dirtyConnectors
    .map((id) => connectorsById.get(id))
    .filter(Boolean)
    .map((conn) => connectorToRow(conn, spaceId));
  const commentRows = pending.dirtyComments
    .map((id) => commentsById.get(id))
    .filter(Boolean)
    .map((comment) => commentToRow(comment, spaceId, actingUserId));

  try {
    if (pending.deletedNodes.length > 0) {
      throwIfDbError(
        await db.from('space_nodes').delete().in('id', pending.deletedNodes),
        `delete ${pending.deletedNodes.length} nodes`,
      );
    }
    if (pending.deletedConnectors.length > 0) {
      throwIfDbError(
        await db.from('space_connectors').delete().in('id', pending.deletedConnectors),
        `delete ${pending.deletedConnectors.length} connectors`,
      );
    }
    if (pending.deletedComments.length > 0) {
      throwIfDbError(
        await db.from('space_comments').delete().in('id', pending.deletedComments),
        `delete ${pending.deletedComments.length} comments`,
      );
    }
    if (nodeRows.length > 0) {
      throwIfDbError(
        await db.from('space_nodes').upsert(nodeRows, { onConflict: 'id' }),
        `upsert ${nodeRows.length} nodes`,
      );
    }
    if (connectorRows.length > 0) {
      throwIfDbError(
        await db.from('space_connectors').upsert(connectorRows, { onConflict: 'id' }),
        `upsert ${connectorRows.length} connectors`,
      );
    }
    if (commentRows.length > 0) {
      throwIfDbError(
        await db.from('space_comments').upsert(commentRows, { onConflict: 'id' }),
        `upsert ${commentRows.length} comments`,
      );
    }
  } catch (err) {
    // Falhou: devolve tudo para a fila (gravações são idempotentes) e o roomManager tenta de novo.
    pending.deletedNodes.forEach((id) => deleted.nodes.add(id));
    pending.deletedConnectors.forEach((id) => deleted.connectors.add(id));
    pending.deletedComments.forEach((id) => deleted.comments.add(id));
    pending.dirtyNodes.forEach((id) => { if (!deleted.nodes.has(id)) dirty.nodes.add(id); });
    pending.dirtyConnectors.forEach((id) => { if (!deleted.connectors.has(id)) dirty.connectors.add(id); });
    pending.dirtyComments.forEach((id) => { if (!deleted.comments.has(id)) dirty.comments.add(id); });
    throw err;
  }
}
