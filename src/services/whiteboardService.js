import { supabase } from './supabaseClient';
import { uuidv4 } from '../utils/uuid';

const NODE_TYPES = ['sticky_note', 'text', 'shape', 'frame', 'connector', 'image', 'comment', 'link', 'todo_list', 'file_card', 'drawing', 'column', 'table'];

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
        replies: row.replies ?? [],
    };
}

// ── NODES ─────────────────────────────────────────────────────────

export async function fetchNodes(spaceId) {
    if (!spaceId) return { data: [], error: null };
    const { data, error } = await supabase
        .from('space_nodes')
        .select('*')
        .eq('space_id', spaceId)
        .order('z_index', { ascending: true })
        .order('created_at', { ascending: true });

    if (error) {
        console.error('[whiteboardService] fetchNodes error', error);
        return { data: [], error: error.message };
    }
    return { data: (data || []).map(rowToNode), error: null };
}

export async function insertNode(spaceId, node, userId = null) {
    if (!spaceId || !node?.type || !NODE_TYPES.includes(node.type))
        return { success: false, error: 'Invalid node or type' };
    const row = nodeToRow({ ...node, createdBy: userId }, spaceId);
    const { error } = await supabase.from('space_nodes').insert(row);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function updateNode(nodeId, patch) {
    if (!nodeId) return { success: false, error: 'Missing nodeId' };
    const dbUpdates = {};
    if (patch.x !== undefined) dbUpdates.x = patch.x;
    if (patch.y !== undefined) dbUpdates.y = patch.y;
    if (patch.width !== undefined) dbUpdates.width = patch.width;
    if (patch.height !== undefined) dbUpdates.height = patch.height;
    if (patch.rotation !== undefined) dbUpdates.rotation = patch.rotation;
    if (patch.scale !== undefined) dbUpdates.scale = patch.scale;
    if (patch.data !== undefined) dbUpdates.data_json = patch.data;
    if (patch.style !== undefined) dbUpdates.style_json = patch.style;
    if (patch.parentId !== undefined) dbUpdates.parent_id = patch.parentId;
    if (patch.zIndex !== undefined) dbUpdates.z_index = patch.zIndex;
    if (Object.keys(dbUpdates).length === 0) return { success: true };
    const { error } = await supabase.from('space_nodes').update(dbUpdates).eq('id', nodeId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function deleteNode(nodeId) {
    if (!nodeId) return { success: false, error: 'Missing nodeId' };
    const { error } = await supabase.from('space_nodes').delete().eq('id', nodeId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function bulkUpdateNodes(patches) {
    if (!patches?.length) return { success: true };
    const errors = [];
    for (const p of patches) {
        const { error } = await updateNode(p.id, p.patch);
        if (error) errors.push({ id: p.id, error });
    }
    if (errors.length) return { success: false, errors };
    return { success: true };
}

// ── CONNECTORS ────────────────────────────────────────────────────

export async function fetchConnectors(spaceId) {
    if (!spaceId) return { data: [], error: null };
    const { data, error } = await supabase
        .from('space_connectors')
        .select('*')
        .eq('space_id', spaceId);

    if (error) {
        console.error('[whiteboardService] fetchConnectors error', error);
        return { data: [], error: error.message };
    }
    return { data: (data || []).map(rowToConnector), error: null };
}

export async function insertConnector(spaceId, connector) {
    if (!spaceId || !connector?.fromNodeId || !connector?.toNodeId)
        return { success: false, error: 'Invalid connector' };
    const row = connectorToRow(connector, spaceId);
    const { data, error } = await supabase.from('space_connectors').insert(row).select('id').single();
    if (error) return { success: false, error: error.message };
    return { success: true, id: data?.id };
}

export async function updateConnector(connectorId, patch) {
    if (!connectorId) return { success: false, error: 'Missing connectorId' };
    const dbUpdates = {};
    if (patch.controlPoints !== undefined) dbUpdates.control_points = patch.controlPoints;
    if (patch.style !== undefined) dbUpdates.style_json = patch.style;
    if (Object.keys(dbUpdates).length === 0) return { success: true };
    const { error } = await supabase.from('space_connectors').update(dbUpdates).eq('id', connectorId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function deleteConnector(connectorId) {
    if (!connectorId) return { success: false, error: 'Missing connectorId' };
    const { error } = await supabase.from('space_connectors').delete().eq('id', connectorId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

// ── COMMENTS ──────────────────────────────────────────────────────

export async function fetchComments(spaceId) {
    if (!spaceId) return { data: [], error: null };
    const { data, error } = await supabase
        .from('space_comments')
        .select('*')
        .eq('space_id', spaceId)
        .is('parent_id', null)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[whiteboardService] fetchComments error', error);
        return { data: [], error: error.message };
    }
    const comments = (data || []).map(rowToComment);
    for (const c of comments) {
        const { data: replies } = await supabase
            .from('space_comments')
            .select('*')
            .eq('parent_id', c.id)
            .order('created_at', { ascending: true });
        c.replies = (replies || []).map(rowToComment);
    }
    return { data: comments, error: null };
}

export async function insertComment(spaceId, comment, authorId) {
    if (!spaceId || !comment?.message || !authorId)
        return { success: false, error: 'Invalid comment or author' };
    const row = commentToRow({ ...comment, authorId }, spaceId);
    const { data, error } = await supabase.from('space_comments').insert(row).select('id').single();
    if (error) return { success: false, error: error.message };
    return { success: true, id: data?.id };
}

export async function fetchReplies(commentId) {
    if (!commentId) return { data: [], error: null };
    const { data, error } = await supabase
        .from('space_comments')
        .select('*')
        .eq('parent_id', commentId)
        .order('created_at', { ascending: true });
    if (error) return { data: [], error: error.message };
    return { data: (data || []).map(rowToComment), error: null };
}

// ── ASSETS (Storage) ─────────────────────────────────────────────

const BUCKET = 'space-assets';

export async function uploadSpaceAsset(spaceId, file, userId = null) {
    if (!spaceId || !file) return { success: false, error: 'Missing spaceId or file' };
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${spaceId}/${uuidv4()}.${ext}`;
    const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
    });
    if (error) return { success: false, error: error.message };
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
    const url = urlData?.publicUrl ?? null;
    const { error: insertErr } = await supabase.from('space_assets').insert({
        space_id: spaceId,
        storage_path: data.path,
        url,
        filename: file.name,
        created_by: userId,
    });
    if (insertErr) console.warn('[whiteboardService] space_assets insert failed', insertErr);
    return { success: true, url, path: data.path };
}

export async function deleteSpaceAsset(spaceId, storagePath) {
    if (!spaceId || !storagePath) return { success: false, error: 'Missing params' };
    await supabase.storage.from(BUCKET).remove([storagePath]);
    await supabase.from('space_assets').delete().eq('space_id', spaceId).eq('storage_path', storagePath);
    return { success: true };
}
