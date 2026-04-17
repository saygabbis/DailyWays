import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from './supabaseClient';

export async function fetchActivity(cardId) {
  if (!cardId) return { data: [], error: null };

  const { data, error } = await supabase
    .from('card_activity_logs')
    .select('*')
    .eq('card_id', cardId)
    .order('created_at', { ascending: false });

  if (error) return { data: [], error: error.message || 'Erro ao carregar atividade.' };

  return {
    data: (data || []).map((row) => ({
      id: row.id,
      cardId: row.card_id,
      actorId: row.actor_id,
      eventType: row.event_type,
      payload: row.payload || {},
      createdAt: row.created_at,
    })),
    error: null,
  };
}

export async function createActivity(cardId, actorId, eventType, payload = {}) {
  const { data, error } = await supabase
    .from('card_activity_logs')
    .insert({
      card_id: cardId,
      actor_id: actorId,
      event_type: eventType,
      payload,
    })
    .select('*')
    .single();

  if (error) return { success: false, error: error.message || 'Erro ao registrar atividade.' };
  return { success: true, data };
}

export function formatActivityText(item) {
  const relative = formatDistanceToNow(new Date(item.createdAt), {
    addSuffix: true,
    locale: ptBR,
  });

  switch (item.eventType) {
    case 'attachment_added':
      return `Anexo adicionado ${relative}`;
    case 'attachment_removed':
      return `Anexo removido ${relative}`;
    case 'cover_set':
      return `Capa definida ${relative}`;
    case 'cover_cleared':
      return `Capa removida ${relative}`;
    case 'comment_added':
      return `Comentário criado ${relative}`;
    case 'comment_deleted':
      return `Comentário removido ${relative}`;
    case 'assignee_added':
      return `Responsável adicionado ${relative}`;
    case 'assignee_removed':
      return `Responsável removido ${relative}`;
    default:
      return `${item.eventType} ${relative}`;
  }
}

export function subscribeToActivity(cardId, onChange) {
  if (!cardId) return () => {};

  const channel = supabase
    .channel(`card-activity:${cardId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'card_activity_logs',
      filter: `card_id=eq.${cardId}`,
    }, onChange)
    .subscribe();

  return () => supabase.removeChannel(channel);
}
