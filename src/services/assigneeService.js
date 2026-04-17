import { supabase } from './supabaseClient';

export async function fetchAssignees(cardId) {
  if (!cardId) return { data: [], error: null };

  const { data, error } = await supabase
    .from('card_assignees')
    .select('*')
    .eq('card_id', cardId)
    .order('created_at', { ascending: true });

  if (error) return { data: [], error: error.message || 'Erro ao carregar responsáveis.' };

  return {
    data: (data || []).map((row) => ({
      cardId: row.card_id,
      userId: row.user_id,
      assignedBy: row.assigned_by,
      createdAt: row.created_at,
    })),
    error: null,
  };
}

export async function fetchBoardCandidates(boardId) {
  if (!boardId) return { data: [], error: null };

  const { data: members, error: membersError } = await supabase
    .from('board_members')
    .select('user_id, role')
    .eq('board_id', boardId);

  if (membersError) return { data: [], error: membersError.message || 'Erro ao carregar membros.' };

  const userIds = (members || []).map((member) => member.user_id);
  if (!userIds.length) return { data: [], error: null };

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, name, avatar, photo_url')
    .in('id', userIds);

  if (profilesError) return { data: [], error: profilesError.message || 'Erro ao carregar perfis.' };

  const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
  return {
    data: (members || []).map((member) => ({
      userId: member.user_id,
      role: member.role,
      ...profileById.get(member.user_id),
    })),
    error: null,
  };
}

export async function assignUser(cardId, userId, assignedBy) {
  const { error } = await supabase
    .from('card_assignees')
    .insert({
      card_id: cardId,
      user_id: userId,
      assigned_by: assignedBy,
    });

  if (error) return { success: false, error: error.message || 'Erro ao atribuir usuário.' };
  return { success: true };
}

export async function removeUser(cardId, userId) {
  const { error } = await supabase
    .from('card_assignees')
    .delete()
    .eq('card_id', cardId)
    .eq('user_id', userId);

  if (error) return { success: false, error: error.message || 'Erro ao remover usuário.' };
  return { success: true };
}

export function subscribeToAssignees(cardId, onChange) {
  if (!cardId) return () => {};

  const channel = supabase
    .channel(`card-assignees:${cardId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'card_assignees',
      filter: `card_id=eq.${cardId}`,
    }, onChange)
    .subscribe();

  return () => supabase.removeChannel(channel);
}
