import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import {
    fetchJournalNotes,
    insertJournalNote,
    updateJournalNote,
} from '../services/journalService';

export function useDiaryReflection() {
    const { user } = useAuth();
    const [content, setContent] = useState('');
    const [noteId, setNoteId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const saveTimeout = useRef(null);
    const textareaRef = useRef(null);

    const todayReflectionTitle = useMemo(
        () => `Reflexão — ${format(new Date(), "d 'de' MMMM", { locale: ptBR })}`,
        []
    );

    useEffect(() => {
        let cancelled = false;
        async function load() {
            if (!user?.id) {
                setLoading(false);
                return;
            }
            setLoading(true);
            const { data } = await fetchJournalNotes(user.id);
            if (cancelled) return;

            const todayNote = (data || []).find(n =>
                n.title?.startsWith('Reflexão —')
                && format(new Date(n.createdAt), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
            );

            if (todayNote) {
                setNoteId(todayNote.id);
                setContent(todayNote.content || '');
            } else {
                const { data: created } = await insertJournalNote(user.id, {
                    title: todayReflectionTitle,
                    content: '',
                });
                if (!cancelled && created) {
                    setNoteId(created.id);
                    setContent('');
                }
            }
            setLoading(false);
        }
        load();
        return () => { cancelled = true; };
    }, [user?.id, todayReflectionTitle]);

    useEffect(() => {
        if (!noteId || !user?.id) return;
        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        saveTimeout.current = setTimeout(async () => {
            setSaving(true);
            await updateJournalNote(noteId, { content, title: todayReflectionTitle });
            setSaving(false);
        }, 800);
        return () => {
            if (saveTimeout.current) clearTimeout(saveTimeout.current);
        };
    }, [content, noteId, user?.id, todayReflectionTitle]);

    const applyPrompt = (prefix) => {
        const ta = textareaRef.current;
        const next = content.trim() ? `${content.trim()}\n\n${prefix}` : prefix;
        setContent(next);
        requestAnimationFrame(() => {
            ta?.focus();
            ta?.setSelectionRange(next.length, next.length);
        });
    };

    const hasContent = content.trim().length > 0;

    return {
        content,
        setContent,
        loading,
        saving,
        textareaRef,
        applyPrompt,
        hasContent,
        todayReflectionTitle,
    };
}
