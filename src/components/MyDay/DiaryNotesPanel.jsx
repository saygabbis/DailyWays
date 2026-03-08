import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { insertJournalNote, fetchJournalNotes, updateJournalNote, deleteJournalNote } from '../../services/journalService';
import { Maximize2, Minimize2, ExternalLink, Trash2, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const NOTES_PER_PAGE = 6;

export default function DiaryNotesPanel() {
    const { user } = useAuth();
    const [notes, setNotes] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [draftTitle, setDraftTitle] = useState('');
    const [draftContent, setDraftContent] = useState('');
    const saveTimeout = useRef(null);
    const textareaRef = useRef(null);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            if (!user?.id) {
                setLoading(false);
                return;
            }
            setLoading(true);
            const { data, error: err } = await fetchJournalNotes(user.id);
            if (cancelled) return;
            if (err) setError(err);
            setNotes(data || []);
            if (data && data.length > 0) {
                setSelectedId(data[0].id);
                setDraftTitle(data[0].title || '');
                setDraftContent(data[0].content || '');
            }
            setLoading(false);
        }
        load();
        return () => { cancelled = true; };
    }, [user?.id]);

    const selectedNote = useMemo(
        () => notes.find(n => n.id === selectedId) || null,
        [notes, selectedId]
    );

    useEffect(() => {
        if (!selectedNote) {
            setDraftTitle('');
            setDraftContent('');
            return;
        }
        setDraftTitle(selectedNote.title || '');
        setDraftContent(selectedNote.content || '');
    }, [selectedNote?.id]);

    useEffect(() => {
        if (!selectedNote) return;
        if (!user?.id) return;
        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        saveTimeout.current = setTimeout(async () => {
            setSaving(true);
            const { data, error: err } = await updateJournalNote(selectedNote.id, {
                title: draftTitle,
                content: draftContent,
            });
            setSaving(false);
            if (err) {
                setError(err);
                return;
            }
            setNotes(prev =>
                prev.map(n => (n.id === data.id ? { ...n, ...data } : n))
            );
        }, 800);
        return () => {
            if (saveTimeout.current) clearTimeout(saveTimeout.current);
        };
    }, [draftTitle, draftContent, selectedNote?.id, user?.id]);

    const totalPages = Math.max(1, Math.ceil(notes.length / NOTES_PER_PAGE));
    const currentPage = Math.min(page, totalPages - 1);
    const startIndex = currentPage * NOTES_PER_PAGE;
    const pageNotes = notes.slice(startIndex, startIndex + NOTES_PER_PAGE);

    const handleSelectNote = (note) => {
        setSelectedId(note.id);
        setIsModalOpen(true);
    };

    const handleNewNote = async () => {
        if (!user?.id) return;
        const todayTitle = format(new Date(), "dd 'de' MMMM yyyy", { locale: ptBR });
        const { data, error: err } = await insertJournalNote(user.id, {
            title: todayTitle,
            content: '',
        });
        if (err) {
            setError(err);
            return;
        }
        setNotes(prev => [data, ...prev]);
        setSelectedId(data.id);
        setPage(0);
        setDraftTitle(data.title || '');
        setDraftContent('');
        setIsModalOpen(true);
    };

    const handleDeleteNote = async () => {
        if (!selectedNote) return;
        const id = selectedNote.id;
        await deleteJournalNote(id);
        setNotes(prev => prev.filter(n => n.id !== id));
        if (notes.length <= 1) {
            setSelectedId(null);
            setDraftTitle('');
            setDraftContent('');
            setIsModalOpen(false);
            return;
        }
        const remaining = notes.filter(n => n.id !== id);
        setSelectedId(remaining[0].id);
    };

    const applyFormat = (wrapper) => {
        const ta = textareaRef.current;
        if (!ta) return;
        const start = ta.selectionStart ?? 0;
        const end = ta.selectionEnd ?? 0;
        const value = draftContent || '';
        const selected = value.slice(start, end);
        const before = value.slice(0, start);
        const after = value.slice(end);
        const newText = before + wrapper.before + selected + wrapper.after + after;
        setDraftContent(newText);
        const cursor = start + wrapper.before.length + selected.length + wrapper.after.length;
        requestAnimationFrame(() => {
            ta.focus();
            ta.selectionStart = ta.selectionEnd = cursor;
        });
    };

    const toolbarDisabled = !selectedNote;

    return (
        <section className={`diary-column diary-column-right ${isFullscreen ? 'diary-notes-fullscreen' : ''}`}>
            <div className="diary-column-header">
                <div>
                    <div className="diary-column-title">
                        Diário de Anotações
                    </div>
                    <div className="diary-column-subtitle">
                        Registre pensamentos, aprendizados e pequenos logs do seu dia.
                    </div>
                </div>
                <div className="diary-notes-actions">
                    <button
                        type="button"
                        className="btn-icon btn-xs"
                        title={isFullscreen ? 'Restaurar painel' : 'Maximizar painel'}
                        onClick={() => setIsFullscreen(v => !v)}
                    >
                        {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </button>
                    <button
                        type="button"
                        className="btn-icon btn-xs"
                        title="Abrir nota em destaque"
                        onClick={() => setIsFullscreen(true)}
                    >
                        <ExternalLink size={14} />
                    </button>
                </div>
            </div>

            <div className="diary-notes-list">
                <div className="diary-notes-sidebar-header">
                    <span className="diary-notes-sidebar-title">Notas</span>
                    <button
                        type="button"
                        className="btn-icon btn-xs"
                        title="Nova nota"
                        onClick={handleNewNote}
                    >
                        <Plus size={14} />
                    </button>
                </div>

                <div className="diary-notes-frames">
                    {loading && <div className="diary-notes-empty">Carregando notas...</div>}
                    {!loading && pageNotes.length === 0 && (
                        <div className="diary-notes-empty">
                            Nenhuma nota ainda. Clique em <strong>+</strong> para começar.
                        </div>
                    )}
                    {pageNotes.map(note => (
                        <button
                            key={note.id}
                            type="button"
                            className={`diary-note-frame ${note.id === selectedId ? 'active' : ''}`}
                            onClick={() => handleSelectNote(note)}
                        >
                            <div className="diary-note-frame-title">
                                {note.title || 'Sem título'}
                            </div>
                            <div className="diary-note-frame-meta">
                                {note.updatedAt
                                    ? format(new Date(note.updatedAt), "dd/MM · HH:mm")
                                    : format(new Date(note.createdAt), "dd/MM · HH:mm")}
                            </div>
                        </button>
                    ))}
                </div>

                {totalPages > 1 && (
                    <div className="diary-notes-pagination">
                        <button
                            type="button"
                            className="diary-notes-page-btn"
                            disabled={currentPage === 0}
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                        >
                            ‹
                        </button>
                        <span className="diary-notes-page-label">
                            {currentPage + 1}/{totalPages}
                        </span>
                        <button
                            type="button"
                            className="diary-notes-page-btn"
                            disabled={currentPage >= totalPages - 1}
                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                        >
                            ›
                        </button>
                    </div>
                )}
            </div>

            {isModalOpen && selectedNote && (
                <div className="diary-notes-modal-backdrop" onClick={() => setIsModalOpen(false)}>
                    <div className="diary-notes-modal" onClick={e => e.stopPropagation()}>
                        <div className="diary-notes-editor-header">
                            <input
                                className="diary-notes-title-input"
                                placeholder="Título da nota..."
                                value={draftTitle}
                                onChange={e => setDraftTitle(e.target.value)}
                            />
                            <div className="diary-notes-editor-actions">
                                <button
                                    type="button"
                                    className="btn-icon btn-xs"
                                    title="Apagar nota"
                                    onClick={handleDeleteNote}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>

                        <div className="diary-notes-toolbar">
                            <button
                                type="button"
                                disabled={toolbarDisabled}
                                onClick={() => applyFormat({ before: '**', after: '**' })}
                            >
                                B
                            </button>
                            <button
                                type="button"
                                disabled={toolbarDisabled}
                                onClick={() => applyFormat({ before: '*', after: '*' })}
                            >
                                I
                            </button>
                            <button
                                type="button"
                                disabled={toolbarDisabled}
                                onClick={() => applyFormat({ before: '# ', after: '' })}
                            >
                                H1
                            </button>
                            <button
                                type="button"
                                disabled={toolbarDisabled}
                                onClick={() => applyFormat({ before: '## ', after: '' })}
                            >
                                H2
                            </button>
                            <button
                                type="button"
                                disabled={toolbarDisabled}
                                onClick={() => applyFormat({ before: '- ', after: '' })}
                            >
                                • Lista
                            </button>
                            <span className="diary-notes-toolbar-status">
                                {saving ? 'Salvando...' : 'Auto-save ativo'}
                            </span>
                        </div>

                        <textarea
                            ref={textareaRef}
                            className="diary-notes-textarea"
                            placeholder="Escreva aqui suas anotações. Suporte básico a Markdown: **negrito**, *itálico*, títulos com # e listas com -."
                            value={draftContent}
                            onChange={e => setDraftContent(e.target.value)}
                        />

                        {error && (
                            <div className="diary-notes-error">
                                {error}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}

