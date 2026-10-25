import { optimizeImageForUpload, thumbPathFor } from '../utils/imageOptimize';
import { supabase } from './supabaseClient';
import { uuidv4 } from '../utils/uuid';

const NODE_TYPES = ['sticky_note', 'text', 'shape', 'frame', 'connector', 'image', 'comment', 'link', 'todo_list', 'file_card', 'drawing', 'table'];

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

export async function deleteNode(nodeId) {
    if (!nodeId) return { success: false, error: 'Missing nodeId' };
    const { error } = await supabase.from('space_nodes').delete().eq('id', nodeId);
    if (error) return { success: false, error: error.message };
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

// ── RULER GUIDES ──────────────────────────────────────────────────

function guideToRow(guide, spaceId) {
    return {
        id: guide.id,
        space_id: spaceId,
        page_id: guide.pageId ?? 'page-main',
        axis: guide.axis,
        position: guide.position,
    };
}

function rowToGuide(row) {
    if (!row) return null;
    return {
        id: row.id,
        spaceId: row.space_id,
        pageId: row.page_id,
        axis: row.axis,
        position: row.position,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export async function fetchRulerGuides(spaceId) {
    if (!spaceId) return { data: [], error: null };
    const { data, error } = await supabase
        .from('space_ruler_guides')
        .select('*')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('[whiteboardService] fetchRulerGuides error', error);
        return { data: [], error: error.message };
    }
    return { data: (data || []).map(rowToGuide), error: null };
}

export async function insertRulerGuide(spaceId, guide) {
    if (!spaceId || !guide?.id || !['x', 'y'].includes(guide.axis))
        return { success: false, error: 'Invalid guide' };
    const row = guideToRow(guide, spaceId);
    const { error } = await supabase.from('space_ruler_guides').insert(row);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function updateRulerGuide(guideId, patch) {
    if (!guideId) return { success: false, error: 'Missing guideId' };
    const dbUpdates = {};
    if (patch.position !== undefined) dbUpdates.position = patch.position;
    if (patch.pageId !== undefined) dbUpdates.page_id = patch.pageId;
    if (patch.axis !== undefined) dbUpdates.axis = patch.axis;
    if (Object.keys(dbUpdates).length === 0) return { success: true };
    const { error } = await supabase.from('space_ruler_guides').update(dbUpdates).eq('id', guideId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function deleteRulerGuides(guideIds) {
    if (!guideIds?.length) return { success: true };
    const { error } = await supabase.from('space_ruler_guides').delete().in('id', guideIds);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

// ── ASSETS (Storage) ─────────────────────────────────────────────

import { validateFile, isImageFile } from '@dailyways/limits';
import { resolveLimitError } from '../limits/messages.js';
import { SPACE_ASSETS_BUCKET, resolveSpaceAssetUrl } from './spaceAssetService';

/** Miniaturas enviadas nesta sessão (o payload do nó de imagem guarda o caminho delas). */
const uploadedThumbs = new Set();
export function hasUploadedThumb(storagePath) {
    return uploadedThumbs.has(storagePath);
}

export async function uploadSpaceAsset(spaceId, originalFile, userId = null) {
    if (!spaceId || !originalFile) return { success: false, error: 'Missing spaceId or file' };
    const image = isImageFile(originalFile);
    const fileCheck = validateFile(originalFile, image ? 'whiteboardImage' : 'whiteboardFile');
    if (!fileCheck.ok) return { success: false, error: resolveLimitError(fileCheck) };
    // Imagem grande: reduz/regrava em WebP e gera miniatura (canvas carrega bem menos dados).
    const optimized = image ? await optimizeImageForUpload(originalFile) : { file: originalFile, thumb: null };
    const file = optimized.file;
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${spaceId}/${uuidv4()}.${ext}`;
    const { error } = await supabase.storage.from(SPACE_ASSETS_BUCKET).upload(path, file, {
        cacheControl: '31536000',
        upsert: false,
        contentType: file.type || undefined,
    });
    if (error) return { success: false, error: error.message };
    let thumbStoragePath = null;
    if (optimized.thumb) {
        const tp = thumbPathFor(path);
        const { error: thumbErr } = await supabase.storage.from(SPACE_ASSETS_BUCKET).upload(tp, optimized.thumb, {
            cacheControl: '31536000',
            upsert: false,
            contentType: 'image/webp',
        });
        if (!thumbErr) {
            thumbStoragePath = tp;
            uploadedThumbs.add(path);
        }
    }
    const url = await resolveSpaceAssetUrl(path);
    const { error: insertErr } = await supabase.from('space_assets').insert({
        space_id: spaceId,
        storage_path: path,
        url: null,
        filename: file.name,
        created_by: userId,
    });
    if (insertErr) console.warn('[whiteboardService] space_assets insert failed', insertErr);
    return { success: true, url, path, storagePath: path, thumbStoragePath };
}

