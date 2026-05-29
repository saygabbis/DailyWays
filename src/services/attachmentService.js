import { validateFile, COUNT, validateLinkUrl, validateLinkLabel } from '@dailyways/limits';
import { resolveLimitError, LIMIT_MSG } from '../limits/messages.js';
import { supabase } from './supabaseClient';

const BUCKET = 'task-attachments';
const SIGNED_URL_TTL_SECONDS = 60 * 60;

function createStoragePath(cardId, fileName = 'file') {
  const safeName = fileName.replace(/\s+/g, '-');
  return `${cardId}/${Date.now()}-${safeName}`;
}

async function resolveAttachmentUrl(storagePath) {
  if (!storagePath) return null;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error) return null;
  return data?.signedUrl ?? null;
}

/** URL assinada da capa (1 query) — usado no card do board. */
export async function fetchCoverAttachmentUrl(cardId, coverAttachmentId) {
  if (!cardId || !coverAttachmentId) {
    return { url: null, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('card_attachments')
      .select('id, storage_path, kind')
      .eq('id', coverAttachmentId)
      .eq('card_id', cardId)
      .maybeSingle();

    if (error) {
      return { url: null, error: error.message || 'Erro ao carregar capa.' };
    }
    if (!data?.storage_path || data.kind !== 'image') {
      return { url: null, error: 'Capa não encontrada.' };
    }

    const url = await resolveAttachmentUrl(data.storage_path);
    return { url, error: url ? null : 'URL da capa indisponível.' };
  } catch (err) {
    return { url: null, error: err?.message || 'Erro ao carregar capa.' };
  }
}

export async function fetchAttachments(cardId) {
  if (!cardId) return { data: [], error: null };

  try {
    const { data, error } = await supabase
      .from('card_attachments')
      .select('*')
      .eq('card_id', cardId)
      .order('created_at', { ascending: false });

    if (error) return { data: [], error: error.message || 'Erro ao carregar anexos.' };

    const rows = await Promise.all((data || []).map(async (row) => {
      const publicUrl = row.storage_path
        ? await resolveAttachmentUrl(row.storage_path)
        : null;

      return {
        id: row.id,
        cardId: row.card_id,
        kind: row.kind,
        storagePath: row.storage_path,
        fileName: row.file_name,
        mimeType: row.mime_type,
        sizeBytes: row.size_bytes,
        linkUrl: row.link_url,
        linkLabel: row.link_label,
        description: row.link_label || '',
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        publicUrl,
      };
    }));

    return { data: rows, error: null };
  } catch (error) {
    return { data: [], error: error?.message || 'Erro ao carregar anexos.' };
  }
}

export async function uploadAttachment(cardId, file, userId) {
  if (!cardId || !file || !userId) {
    return { success: false, error: 'Dados inválidos para upload.' };
  }
  const fileCheck = validateFile(file, 'cardAttachment');
  if (!fileCheck.ok) return { success: false, error: resolveLimitError(fileCheck) };

  try {
    const { count, error: countErr } = await supabase
      .from('card_attachments')
      .select('id', { count: 'exact', head: true })
      .eq('card_id', cardId);
    if (!countErr && (count ?? 0) >= COUNT.attachmentsPerCard) {
      return { success: false, error: LIMIT_MSG.attachments };
    }
    const storagePath = createStoragePath(cardId, file.name);
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, { upsert: false, contentType: file.type });

    if (uploadError) {
      return { success: false, error: uploadError.message || 'Erro ao enviar arquivo.' };
    }

    const kind = file.type?.startsWith('image/') ? 'image' : 'file';
    const { data, error } = await supabase
      .from('card_attachments')
      .insert({
        card_id: cardId,
        kind,
        storage_path: storagePath,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size || null,
        created_by: userId,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
      return { success: false, error: error.message || 'Erro ao registrar anexo.' };
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: error?.message || 'Erro ao enviar arquivo.' };
  }
}

export async function createLinkAttachment(cardId, linkUrl, linkLabel, userId) {
  if (!cardId || !linkUrl || !userId) {
    return { success: false, error: 'Dados inválidos para link.' };
  }
  const urlCheck = validateLinkUrl(linkUrl);
  if (!urlCheck.ok) return { success: false, error: resolveLimitError(urlCheck) };
  if (linkLabel) {
    const labelCheck = validateLinkLabel(linkLabel);
    if (!labelCheck.ok) return { success: false, error: resolveLimitError(labelCheck) };
  }
  const { count, error: countErr } = await supabase
    .from('card_attachments')
    .select('id', { count: 'exact', head: true })
    .eq('card_id', cardId);
  if (!countErr && (count ?? 0) >= COUNT.attachmentsPerCard) {
    return { success: false, error: LIMIT_MSG.attachments };
  }

  const { data, error } = await supabase
    .from('card_attachments')
    .insert({
      card_id: cardId,
      kind: 'link',
      link_url: linkUrl,
      link_label: linkLabel || null,
      file_name: linkLabel || linkUrl,
      created_by: userId,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) return { success: false, error: error.message || 'Erro ao salvar link.' };
  return { success: true, data };
}

export async function renameAttachment(attachmentId, updates) {
  const payload = {
    updated_at: new Date().toISOString(),
  };

  if (typeof updates.fileName === 'string') payload.file_name = updates.fileName;
  if (typeof updates.description === 'string') payload.link_label = updates.description;

  const { data, error } = await supabase
    .from('card_attachments')
    .update(payload)
    .eq('id', attachmentId)
    .select('*')
    .single();

  if (error) return { success: false, error: error.message || 'Erro ao renomear anexo.' };
  return { success: true, data };
}

export async function removeAttachment(attachment) {
  if (!attachment?.id) return { success: false, error: 'Anexo inválido.' };

  if (attachment.storagePath) {
    await supabase.storage.from(BUCKET).remove([attachment.storagePath]);
  }

  const { error } = await supabase
    .from('card_attachments')
    .delete()
    .eq('id', attachment.id);

  if (error) return { success: false, error: error.message || 'Erro ao remover anexo.' };
  return { success: true };
}

export async function setCardCover(cardId, attachmentId) {
  const { error } = await supabase
    .from('cards')
    .update({ cover_attachment_id: attachmentId, updated_at: new Date().toISOString() })
    .eq('id', cardId);

  if (error) return { success: false, error: error.message || 'Erro ao definir capa.' };
  return { success: true };
}

export async function clearCardCover(cardId) {
  return setCardCover(cardId, null);
}

export function subscribeToAttachments(cardId, onChange) {
  if (!cardId) return () => {};

  const channel = supabase
    .channel(`card-attachments:${cardId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'card_attachments',
      filter: `card_id=eq.${cardId}`,
    }, onChange)
    .subscribe();

  return () => supabase.removeChannel(channel);
}
