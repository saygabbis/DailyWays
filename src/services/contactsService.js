import { supabase } from './supabaseClient';

function normalizeQuery(q) {
  const raw = (q ?? '').trim();
  if (!raw) return '';
  if (raw.startsWith('@')) return raw.slice(1).trim().toLowerCase();
  return raw.toLowerCase();
}

async function getCurrentUserId() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.id) return null;
  return user.id;
}

export async function searchContactTargets(query, limit = 8) {
  const q = normalizeQuery(query);
  if (!q) return { data: [], error: null };
  const { data, error } = await supabase.rpc('search_contact_targets', { q, lim: limit });
  if (error) return { data: [], error: error.message || 'Erro ao buscar usuários.' };
  return { data: data || [], error: null };
}

export async function fetchContacts() {
  const { data, error } = await supabase.rpc('list_mutual_contacts');

  if (!error) {
    const rows = data || [];
    rows.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const aT = a.last_interaction_at || a.created_at || '';
      const bT = b.last_interaction_at || b.created_at || '';
      return bT.localeCompare(aT);
    });
    return { data: rows, error: null };
  }

  // Fallback se migração ainda não aplicada
  const { data: legacy, error: legacyErr } = await supabase
    .from('contacts')
    .select('contact_user_id, nickname, pinned, notify_messages, last_interaction_at, created_at, updated_at')
    .order('pinned', { ascending: false })
    .order('last_interaction_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (legacyErr) return { data: [], error: legacyErr.message || 'Erro ao carregar contatos.' };
  return { data: legacy || [], error: null };
}

export async function updateContact(contactUserId, patch) {
  if (!contactUserId) return { success: false, error: 'Contato inválido.' };
  const { data, error } = await supabase
    .from('contacts')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('contact_user_id', contactUserId)
    .select('*')
    .single();
  if (error) return { success: false, error: error.message || 'Erro ao atualizar contato.' };
  return { success: true, data };
}

export async function removeContact(contactUserId) {
  if (!contactUserId) return { success: false, error: 'Contato inválido.' };

  const { error } = await supabase.rpc('remove_contact_mutual', {
    p_contact_user_id: contactUserId,
  });

  if (!error) return { success: true };

  // Fallback: remove só do seu lado
  const { error: delErr } = await supabase
    .from('contacts')
    .delete()
    .eq('contact_user_id', contactUserId);
  if (delErr) return { success: false, error: delErr.message || 'Erro ao remover contato.' };
  return { success: true };
}

export async function fetchContactRequests() {
  const { data, error } = await supabase
    .from('contact_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return { data: [], error: error.message || 'Erro ao carregar solicitações.' };
  return { data: data || [], error: null };
}

export async function sendContactRequest(targetUserId) {
  if (!targetUserId) return { success: false, error: 'Usuário inválido.' };

  const { data, error } = await supabase.rpc('send_contact_request', {
    p_to_user_id: targetUserId,
  });

  if (!error && data) {
    return { success: true, data, autoAccepted: data?.status === 'accepted' };
  }

  // Fallback se a migração RPC ainda não foi aplicada
  const me = await getCurrentUserId();
  if (!me) return { success: false, error: 'Faça login para adicionar contatos.' };

  const { data: inserted, error: insertErr } = await supabase
    .from('contact_requests')
    .insert({ from_user_id: me, to_user_id: targetUserId })
    .select('*')
    .single();

  if (insertErr) {
    const msg = insertErr.message || 'Erro ao enviar solicitação.';
    if (msg.includes('duplicate') || insertErr.code === '23505') {
      return { success: false, error: 'Já existe uma solicitação com este usuário.' };
    }
    return { success: false, error: msg };
  }
  return { success: true, data: inserted };
}

export async function respondToContactRequest(requestId, status) {
  if (!requestId) return { success: false, error: 'Solicitação inválida.' };
  if (!['accepted', 'declined', 'blocked'].includes(status)) {
    return { success: false, error: 'Status inválido.' };
  }
  const { data, error } = await supabase
    .from('contact_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .select('*')
    .single();
  if (error) return { success: false, error: error.message || 'Erro ao atualizar solicitação.' };
  return { success: true, data };
}
