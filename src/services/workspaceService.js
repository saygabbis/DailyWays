import { supabase } from './supabaseClient';
import { normalizeInviteIdentifier } from '../utils/inviteIdentifier.js';
import { formatInviteError } from '../utils/inviteErrors.js';

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

function mapSpaceRow(s) {
    return {
        id: s.id,
        title: s.title,
        color: s.color,
        emoji: s.emoji,
        position: s.position,
        groupId: s.group_id,
        ownerId: s.owner_id,
        panX: s.pan_x,
        panY: s.pan_y,
        zoom: s.zoom,
        createdAt: s.created_at,
    };
}

export async function fetchSpaces(userId) {
    if (!userId) return { data: [], error: null };

    const { data: owned, error: ownedErr } = await supabase
        .from('spaces')
        .select('*')
        .eq('owner_id', userId)
        .order('position', { ascending: true });

    if (ownedErr) {
        console.error('[workspaceService] fetchSpaces owned error', ownedErr);
        return { data: [], error: ownedErr.message };
    }

    const { data: memberships, error: memErr } = await supabase
        .from('space_members')
        .select('space_id')
        .eq('user_id', userId);

    if (memErr) {
        console.error('[workspaceService] fetchSpaces memberships error', memErr);
    }

    const memberIds = Array.from(new Set((memberships || []).map((m) => m.space_id).filter(Boolean)));
    let shared = [];
    if (memberIds.length > 0) {
        const { data: sharedRows, error: sharedErr } = await supabase
            .from('spaces')
            .select('*')
            .in('id', memberIds)
            .order('position', { ascending: true });
        if (sharedErr) {
            console.error('[workspaceService] fetchSpaces shared error', sharedErr);
        } else {
            shared = sharedRows || [];
        }
    }

    const byId = new Map();
    for (const s of [...(owned || []), ...shared]) {
        if (!byId.has(s.id)) byId.set(s.id, mapSpaceRow(s));
    }
    const spaces = Array.from(byId.values()).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    return { data: spaces, error: null };
}

export function isSpaceOwnerClient(space, userId) {
    if (!space || !userId) return false;
    return space.ownerId === userId;
}

export async function fetchSpaceMembers(spaceId) {
    if (!spaceId) return { data: [], error: null };
    const { data: membersRows, error: membersErr } = await supabase
        .from('space_members')
        .select('space_id, user_id, role')
        .eq('space_id', spaceId);

    if (membersErr) {
        console.error('[workspaceService] fetchSpaceMembers error', membersErr);
        return { data: [], error: membersErr.message || 'Erro ao carregar membros.' };
    }

    const rows = membersRows || [];
    const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
    let profileById = {};
    if (userIds.length > 0) {
        const { data: profiles, error: profilesErr } = await supabase
            .from('profiles')
            .select('id, username, name, avatar, photo_url')
            .in('id', userIds);
        if (!profilesErr && profiles) {
            profileById = profiles.reduce((acc, p) => {
                acc[p.id] = p;
                return acc;
            }, {});
        }
    }

    const members = rows.map((row) => {
        const p = profileById[row.user_id] || null;
        return {
            spaceId: row.space_id,
            userId: row.user_id,
            role: row.role,
            name: p?.name ?? '',
            username: p?.username ?? '',
            avatar: p?.avatar ?? '',
            photoUrl: p?.photo_url ?? '',
        };
    });
    return { data: members, error: null };
}

export async function inviteSpaceMember(spaceId, identifier, role = 'reader') {
    if (!spaceId || !identifier?.trim()) {
        return { success: false, error: 'Indica um @username ou e-mail válido.' };
    }
    const normalizedRole = role === 'editor' ? 'editor' : 'reader';
    const { error } = await supabase.rpc('invite_space_member', {
        p_space_id: spaceId,
        p_identifier: normalizeInviteIdentifier(identifier),
        p_role: normalizedRole,
    });
    if (error) {
        console.error('[workspaceService] inviteSpaceMember error', error);
        return { success: false, error: formatInviteError(error.message) };
    }
    return { success: true };
}

export async function updateSpaceMemberRole(spaceId, memberUserId, role) {
    if (!spaceId || !memberUserId) return { success: false, error: 'Dados inválidos.' };
    const normalizedRole = role === 'editor' ? 'editor' : 'reader';
    const { error } = await supabase
        .from('space_members')
        .update({ role: normalizedRole })
        .eq('space_id', spaceId)
        .eq('user_id', memberUserId);
    if (error) {
        console.error('[workspaceService] updateSpaceMemberRole error', error);
        return { success: false, error: error.message || 'Erro ao atualizar permissão.' };
    }
    return { success: true };
}

export async function removeSpaceMember(spaceId, memberUserId) {
    if (!spaceId || !memberUserId) return { success: false, error: 'Dados inválidos.' };
    const { error } = await supabase
        .from('space_members')
        .delete()
        .eq('space_id', spaceId)
        .eq('user_id', memberUserId);
    if (error) {
        console.error('[workspaceService] removeSpaceMember error', error);
        return { success: false, error: error.message || 'Erro ao remover membro.' };
    }
    return { success: true };
}

export async function leaveSpace(spaceId, userId) {
    if (!spaceId || !userId) return { success: false, error: 'Dados inválidos.' };
    const { error } = await supabase
        .from('space_members')
        .delete()
        .eq('space_id', spaceId)
        .eq('user_id', userId);
    if (error) {
        console.error('[workspaceService] leaveSpace error', error);
        return { success: false, error: error.message || 'Erro ao sair do space.' };
    }
    return { success: true };
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
