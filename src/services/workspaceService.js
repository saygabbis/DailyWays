import { supabase } from './supabaseClient';

// ── GROUPS ────────────────────────────────────────────────────────

export async function fetchGroups(userId) {
    if (!userId) return { data: [], error: null };
    const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('owner_id', userId)
        .order('position', { ascending: true });

    if (error) {
        console.error('[workspaceService] fetchGroups error', error);
        return { data: [], error: error.message };
    }

    // Convert snake_case to camelCase
    const groups = (data || []).map(g => ({
        id: g.id,
        title: g.title,
        type: g.type,
        position: g.position,
        isExpanded: g.is_expanded,
        color: g.color ?? null,
        icon: g.icon ?? null,
        createdAt: g.created_at
    }));
    return { data: groups, error: null };
}

export async function insertGroup(userId, group) {
    const { data, error } = await supabase.from('groups').insert({
        id: group.id,
        owner_id: userId,
        title: group.title,
        type: group.type,
        position: group.position ?? 0,
        is_expanded: group.isExpanded ?? true,
        color: group.color ?? null,
        icon: group.icon ?? null,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function updateGroup(groupId, updates) {
    const dbUpdates = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.position !== undefined) dbUpdates.position = updates.position;
    if (updates.isExpanded !== undefined) dbUpdates.is_expanded = updates.isExpanded;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    if (updates.icon !== undefined) dbUpdates.icon = updates.icon;

    const { error } = await supabase.from('groups').update(dbUpdates).eq('id', groupId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function deleteGroup(groupId) {
    const { error } = await supabase.from('groups').delete().eq('id', groupId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

// ── SPACES ────────────────────────────────────────────────────────

export async function fetchSpaces(userId) {
    if (!userId) return { data: [], error: null };
    const { data, error } = await supabase
        .from('spaces')
        .select('*')
        .eq('owner_id', userId)
        .order('position', { ascending: true });

    if (error) {
        console.error('[workspaceService] fetchSpaces error', error);
        return { data: [], error: error.message };
    }

    const spaces = (data || []).map(s => ({
        id: s.id,
        title: s.title,
        color: s.color,
        emoji: s.emoji,
        position: s.position,
        groupId: s.group_id,
        panX: s.pan_x,
        panY: s.pan_y,
        zoom: s.zoom,
        createdAt: s.created_at
    }));
    return { data: spaces, error: null };
}

export async function insertSpace(userId, space) {
    const { data, error } = await supabase.from('spaces').insert({
        id: space.id,
        owner_id: userId,
        title: space.title,
        color: space.color,
        emoji: space.emoji,
        position: space.position ?? 0,
        group_id: space.groupId ?? null,
        pan_x: space.panX ?? 0,
        pan_y: space.panY ?? 0,
        zoom: space.zoom ?? 1
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function updateSpace(spaceId, updates) {
    const dbUpdates = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    if (updates.emoji !== undefined) dbUpdates.emoji = updates.emoji;
    if (updates.position !== undefined) dbUpdates.position = updates.position;
    if (updates.groupId !== undefined) dbUpdates.group_id = updates.groupId;
    if (updates.panX !== undefined) dbUpdates.pan_x = updates.panX;
    if (updates.panY !== undefined) dbUpdates.pan_y = updates.panY;
    if (updates.zoom !== undefined) dbUpdates.zoom = updates.zoom;

    const { error } = await supabase.from('spaces').update(dbUpdates).eq('id', spaceId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function deleteSpace(spaceId) {
    const { error } = await supabase.from('spaces').delete().eq('id', spaceId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

// ── COMMON BULK UPDATE ──────────────────────────────────────────────

export async function updateEntitiesOrder(table, payloads, isSpace = false) {
    // payloads: [{ id, position, groupId (optional) }]
    if (!payloads?.length) return { success: true };
    const errors = [];
    for (const p of payloads) {
        const updatePayload = { position: p.position };
        if (p.groupId !== undefined) {
            updatePayload.group_id = p.groupId;
        }
        const { error } = await supabase.from(table).update(updatePayload).eq('id', p.id);
        if (error) errors.push(error);
    }
    if (errors.length) return { success: false, error: 'Erro ao reordenar.' };
    return { success: true };
}
