import { supabase } from './supabaseClient';

const CHAT_BUCKET = 'chat-attachments';

function isChannelTopicMatch(channel, topic) {
  const channelTopic = channel?.topic || '';
  return channelTopic === topic || channelTopic.endsWith(`:${topic}`);
}

function removeExistingTopicChannels(topic) {
  const channels = typeof supabase.getChannels === 'function' ? supabase.getChannels() : [];
  for (const ch of channels) {
    if (isChannelTopicMatch(ch, topic)) {
      void supabase.removeChannel(ch);
    }
  }
}

export async function openDmChannel(otherUserId) {
  if (!otherUserId) return { data: null, error: 'Usuário inválido.' };
  const { data, error } = await supabase.rpc('open_dm_channel', { p_other_user_id: otherUserId });
  if (error) return { data: null, error: error.message || 'Erro ao abrir conversa.' };
  return { data, error: null };
}

export async function fetchChatMessages(conversationId, options = 120) {
  if (!conversationId) return { data: [], error: null };
  const parsed = typeof options === 'number'
    ? { limit: options, beforeCreatedAt: null }
    : { limit: options?.limit ?? 120, beforeCreatedAt: options?.beforeCreatedAt ?? null };

  const { data, error } = await supabase.rpc('list_chat_messages', {
    p_conversation_id: conversationId,
    p_limit: parsed.limit,
    p_before_created_at: parsed.beforeCreatedAt,
  });

  if (!error) return { data: data || [], error: null, cursorSupported: true };

  const missingCursorFn = (error.message || '').includes('list_chat_messages(uuid, integer, timestamp with time zone)');
  if (!missingCursorFn) return { data: [], error: error.message || 'Erro ao carregar mensagens.' };

  const fallback = await supabase.rpc('list_chat_messages', {
    p_conversation_id: conversationId,
    p_limit: parsed.limit,
  });
  if (fallback.error) return { data: [], error: fallback.error.message || 'Erro ao carregar mensagens.' };
  return { data: fallback.data || [], error: null, cursorSupported: false };
}

export async function sendChatMessage(conversationId, { body, messageType = 'text', attachmentUrl, attachmentMeta }) {
  if (!conversationId) return { success: false, error: 'Conversa inválida.' };
  const { data, error } = await supabase.rpc('send_chat_message', {
    p_conversation_id: conversationId,
    p_body: body ?? '',
    p_message_type: messageType,
    p_attachment_url: attachmentUrl ?? null,
    p_attachment_meta: attachmentMeta ?? null,
  });
  if (error) return { success: false, error: error.message || 'Erro ao enviar.' };
  return { success: true, data };
}

export async function sendDmMessage(recipientId, body) {
  const trimmed = (body ?? '').trim();
  if (!trimmed) return { success: false, error: 'Mensagem vazia.' };
  const { data, error } = await supabase.rpc('send_dm_message', {
    p_recipient_id: recipientId,
    p_body: trimmed,
  });
  if (error) return { success: false, error: error.message || 'Erro ao enviar.' };
  return { success: true, data };
}

export async function markConversationDelivered(conversationId) {
  if (!conversationId) return;
  await supabase.rpc('mark_conversation_delivered', { p_conversation_id: conversationId });
}

export async function markMessagesRead(conversationId, upToMessageId) {
  if (!conversationId) return;
  await supabase.rpc('mark_messages_read', {
    p_conversation_id: conversationId,
    p_up_to_message_id: upToMessageId ?? null,
  });
}

export async function editChatMessage(messageId, body) {
  const { data, error } = await supabase.rpc('edit_chat_message', {
    p_message_id: messageId,
    p_body: body,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function deleteChatMessage(messageId) {
  const { error } = await supabase.rpc('delete_chat_message', { p_message_id: messageId });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function hideMessageForMe(messageId) {
  const { error } = await supabase.rpc('hide_message_for_me', { p_message_id: messageId });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function clearChatHistoryForMe(conversationId) {
  const { error } = await supabase.rpc('clear_chat_history_for_me', {
    p_conversation_id: conversationId,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function toggleMessageReaction(messageId, emoji) {
  const { data, error } = await supabase.rpc('toggle_message_reaction', {
    p_message_id: messageId,
    p_emoji: emoji,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, added: data };
}

export async function uploadChatImage(conversationId, file) {
  if (!conversationId || !file) return { url: null, error: 'Arquivo inválido.' };
  const ext = file.name?.split('.').pop() || 'jpg';
  const path = `${conversationId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(CHAT_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/jpeg',
  });
  if (error) return { url: null, error: error.message };
  const { data } = supabase.storage.from(CHAT_BUCKET).getPublicUrl(path);
  return {
    url: data.publicUrl,
    meta: { mime: file.type, name: file.name, size: file.size },
    error: null,
  };
}

export async function heartbeatPresence() {
  await supabase.rpc('heartbeat_presence');
}

export async function checkUserOnline(userId) {
  if (!userId) return false;
  const { data, error } = await supabase.rpc('is_user_online', { p_user_id: userId });
  if (error) return false;
  return !!data;
}

export async function fetchConversationParticipants(conversationId) {
  if (!conversationId) return { data: [], error: null };
  const { data, error } = await supabase
    .from('conversation_participants')
    .select('user_id, created_at')
    .eq('conversation_id', conversationId);
  if (error) return { data: [], error: error.message };
  return { data: data || [], error: null };
}

export async function fetchDmRequestMessages(requestId) {
  if (!requestId) return { data: [], error: null };
  const { data, error } = await supabase.rpc('list_dm_request_messages', { p_request_id: requestId });
  if (error) return { data: [], error: error.message };
  return { data: data || [], error: null };
}

export async function fetchDmInbox() {
  const { data, error } = await supabase.rpc('list_dm_inbox');
  if (error) return { data: [], error: error.message };
  return { data: data || [], error: null };
}

export async function countDmInbox() {
  const { data, error } = await supabase.rpc('count_dm_inbox');
  if (error) return { count: 0, error: error.message };
  return { count: typeof data === 'number' ? data : 0, error: null };
}

export async function acceptDmRequest(requestId) {
  const { data, error } = await supabase.rpc('accept_dm_message_request', { p_request_id: requestId });
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function declineDmRequest(requestId) {
  const { error } = await supabase.rpc('decline_dm_message_request', { p_request_id: requestId });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export function subscribeToChatMessages(conversationId, handlers) {
  if (!conversationId) return () => {};
  const topic = `chat-msgs:${conversationId}`;
  // Keep exactly one active realtime subscription per conversation on this client.
  removeExistingTopicChannels(topic);
  const channel = supabase
    .channel(topic)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (p) => handlers.onInsert?.(p.new)
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (p) => handlers.onUpdate?.(p.new)
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'message_receipts' },
      () => handlers.onReceipts?.()
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'message_receipts' },
      () => handlers.onReceipts?.()
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'message_reactions' },
      () => handlers.onReactions?.()
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export function subscribeToDmInbox(userId, onChange) {
  if (!userId) return () => {};
  const channel = supabase
    .channel(`dm-inbox:${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_message_requests', filter: `recipient_id=eq.${userId}` }, onChange)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dm_request_messages' }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export function subscribeToDmRequest(requestId, onChange) {
  if (!requestId) return () => {};
  const channel = supabase
    .channel(`dm-request:${requestId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dm_request_messages', filter: `request_id=eq.${requestId}` }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// Legacy aliases
export const fetchMessages = fetchChatMessages;
export async function sendMessage(conversationId, body, options = {}) {
  if (options.recipientId) return sendDmMessage(options.recipientId, body);
  return sendChatMessage(conversationId, { body });
}
export const subscribeToMessages = (conversationId, onChange) =>
  subscribeToChatMessages(conversationId, { onInsert: onChange, onUpdate: onChange });
