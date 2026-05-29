import { createUserScopedClient } from '../db/supabase.js';

function rowToNode(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    rotation: row.rotation ?? 0,
    scale: row.scale ?? 1,
    data: row.data_json ?? {},
    style: row.style_json ?? {},
    parentId: row.parent_id ?? null,
    zIndex: row.z_index ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by ?? null,
  };
}

function rowToConnector(row) {
  if (!row) return null;
  return {
    id: row.id,
    fromNodeId: row.from_node_id,
    toNodeId: row.to_node_id,
    controlPoints: row.control_points ?? [],
    style: row.style_json ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToComment(row) {
  if (!row) return null;
  return {
    id: row.id,
    spaceId: row.space_id,
    nodeId: row.node_id ?? null,
    x: row.x ?? null,
    y: row.y ?? null,
    authorId: row.author_id,
    message: row.message,
    parentId: row.parent_id ?? null,
    createdAt: row.created_at,
    replies: [],
  };
}

/** Carga inicial do space com RLS do JWT (após canAccessSpace no JOIN). */
export async function loadRoomFromDb(spaceId, accessToken) {
  const db = createUserScopedClient(accessToken);
  if (!db || !spaceId) {
    return { nodes: [], connectors: [], comments: [], revision: 0 };
  }

  const [nodesRes, connRes, commentsRes] = await Promise.all([
    db.from('space_nodes').select('*').eq('space_id', spaceId)
      .order('z_index', { ascending: true }).order('created_at', { ascending: true }),
    db.from('space_connectors').select('*').eq('space_id', spaceId),
    db.from('space_comments').select('*').eq('space_id', spaceId).is('parent_id', null)
      .order('created_at', { ascending: false }),
  ]);

  const nodes = (nodesRes.data || []).map(rowToNode).filter(Boolean);
  const connectors = (connRes.data || []).map(rowToConnector).filter(Boolean);
  const comments = (commentsRes.data || []).map(rowToComment).filter(Boolean);

  return { nodes, connectors, comments, revision: 0 };
}
