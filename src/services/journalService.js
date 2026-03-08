import { supabase } from './supabaseClient';

function rowToNote(row) {
    if (!row) return null;
    return {
        id: row.id,
        userId: row.user_id,
        title: row.title ?? '',
        content: row.content ?? '',
        pinned: row.pinned ?? false,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export async function fetchJournalNotes(userId) {
    if (!userId) return { data: [], error: null };
    const { data, error } = await supabase
        .from('journal_notes')
        .select('*')
        .eq('user_id', userId)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[journalService] fetchJournalNotes error', error);
        return { data: [], error: error.message || 'Erro ao carregar notas do diário.' };
    }

    return { data: (data || []).map(rowToNote), error: null };
}

export async function insertJournalNote(userId, note) {
    if (!userId) return { data: null, error: 'Usuário não autenticado.' };
    const payload = {
        user_id: userId,
        title: note.title ?? '',
        content: note.content ?? '',
        pinned: note.pinned ?? false,
    };

    const { data, error } = await supabase
        .from('journal_notes')
        .insert(payload)
        .select('*')
        .single();

    if (error) {
        console.error('[journalService] insertJournalNote error', error);
        return { data: null, error: error.message || 'Erro ao criar nota.' };
    }

    return { data: rowToNote(data), error: null };
}

export async function updateJournalNote(id, updates) {
    if (!id) return { data: null, error: 'ID da nota não informado.' };

    const dbUpdates = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.content !== undefined) dbUpdates.content = updates.content;
    if (updates.pinned !== undefined) dbUpdates.pinned = updates.pinned;
    dbUpdates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
        .from('journal_notes')
        .update(dbUpdates)
        .eq('id', id)
        .select('*')
        .single();

    if (error) {
        console.error('[journalService] updateJournalNote error', error);
        return { data: null, error: error.message || 'Erro ao atualizar nota.' };
    }

    return { data: rowToNote(data), error: null };
}

export async function deleteJournalNote(id) {
    if (!id) return { success: false, error: 'ID da nota não informado.' };
    const { error } = await supabase
        .from('journal_notes')
        .delete()
        .eq('id', id);
    if (error) {
        console.error('[journalService] deleteJournalNote error', error);
        return { success: false, error: error.message || 'Erro ao apagar nota.' };
    }
    return { success: true, error: null };
}

