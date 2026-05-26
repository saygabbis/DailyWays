import { supabase } from './supabaseClient';

export const PRIVACY_DEFAULTS = {
  allow_contact_requests: 'everyone',
  discoverable_by_email: true,
  discoverable_by_username: true,
  allow_dm_from: 'everyone',
  show_online_status: true,
  read_receipts: true,
};

export async function fetchPrivacySettings() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return { data: { ...PRIVACY_DEFAULTS }, error: null };

  const { data, error } = await supabase
    .from('privacy_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    return { data: { ...PRIVACY_DEFAULTS }, error: error.message || null };
  }
  if (!data) return { data: { ...PRIVACY_DEFAULTS, user_id: user.id }, error: null };
  return {
    data: {
      ...data,
      read_receipts: data.read_receipts_enabled ?? data.read_receipts ?? true,
    },
    error: null,
  };
}

export async function updatePrivacySettings(patch) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return { success: false, error: 'Não autenticado.' };

  const next = {
    ...patch,
    user_id: user.id,
    updated_at: new Date().toISOString(),
    read_receipts_enabled: patch.read_receipts_enabled ?? patch.read_receipts,
  };
  delete next.read_receipts;
  const { data, error } = await supabase
    .from('privacy_settings')
    .upsert(next, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) return { success: false, error: error.message || 'Erro ao salvar privacidade.' };
  return { success: true, data };
}

export async function fetchBlockedUsers() {
  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocked_user_id, created_at');
  if (error) return { data: [], error: error.message || 'Erro ao carregar bloqueios.' };
  return { data: data || [], error: null };
}

export async function blockUser(blockedUserId) {
  if (!blockedUserId) return { success: false, error: 'Usuário inválido.' };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return { success: false, error: 'Não autenticado.' };
  const { error } = await supabase
    .from('blocked_users')
    .insert({ user_id: user.id, blocked_user_id: blockedUserId });
  if (error) return { success: false, error: error.message || 'Erro ao bloquear.' };
  return { success: true };
}

export async function unblockUser(blockedUserId) {
  if (!blockedUserId) return { success: false, error: 'Usuário inválido.' };
  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocked_user_id', blockedUserId);
  if (error) return { success: false, error: error.message || 'Erro ao desbloquear.' };
  return { success: true };
}

