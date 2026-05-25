import { REFLECTION_PROMPTS } from './diaryHubConfig';

export default function DiaryReflectionEditor({
    content,
    setContent,
    loading,
    saving,
    textareaRef,
    applyPrompt,
    compact = false,
}) {
    return (
        <div className={`diary-reflection-editor ${compact ? 'diary-reflection-editor--compact' : ''}`}>
            <div className="diary-reflection-prompts">
                {REFLECTION_PROMPTS.map(p => (
                    <button
                        key={p.id}
                        type="button"
                        className="diary-reflection-prompt-chip"
                        onClick={() => applyPrompt(p.prefix)}
                        disabled={loading}
                    >
                        {p.label}
                    </button>
                ))}
            </div>
            <textarea
                ref={textareaRef}
                className="diary-reflection-textarea"
                placeholder="Como foi seu dia? Escreva o que quiser — ou use uma sugestão acima."
                value={content}
                onChange={e => setContent(e.target.value)}
                disabled={loading}
            />
            <span className="diary-reflection-status">
                {loading ? 'Carregando...' : saving ? 'Salvando...' : 'Auto-save ativo'}
            </span>
        </div>
    );
}
