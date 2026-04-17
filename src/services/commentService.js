import { supabase } from './supabaseClient';

export async function fetchComments(cardId) {
  if (!cardId) return { data: [], error: null };

  const { data, error } = await supabase
    .from('card_comments')
    .select('*')
    .eq('card_id', cardId)
    .order('created_at', { ascending: true });

  if (error) return { data: [], error: error.message || 'Erro ao carregar comentários.' };

  return {
    data: (data || []).map((row) => ({
      id: row.id,
      cardId: row.card_id,
      authorId: row.author_id,
      body: row.body,
      deletedAt: row.deleted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    error: null,
  };
}

export async function createComment(cardId, body, authorId) {
  const { data, error } = await supabase
    .from('card_comments')
    .insert({
      card_id: cardId,
      author_id: authorId,
      body,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) return { success: false, error: error.message || 'Erro ao criar comentário.' };
  return { success: true, data };
}

export async function updateComment(commentId, body) {
  const { data, error } = await supabase
    .from('card_comments')
    .update({ body, updated_at: new Date().toISOString() })
    .eq('id', commentId)
    .select('*')
    .single();

  if (error) return { success: false, error: error.message || 'Erro ao atualizar comentário.' };
  return { success: true, data };
}

export async function softDeleteComment(commentId) {
  const { error } = await supabase
    .from('card_comments')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', commentId);

  if (error) return { success: false, error: error.message || 'Erro ao remover comentário.' };
  return { success: true };
}

export function subscribeToComments(cardId, onChange) {
  if (!cardId) return () => {};

  const channel = supabase
    .channel(`card-comments:${cardId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'card_comments',
      filter: `card_id=eq.${cardId}`,
    }, onChange)
    .subscribe();

  return () => supabase.removeChannel(channel);
}
