import { useState, useEffect } from 'react';
import { X, Palette, CheckCircle } from 'lucide-react';
import './ListDetailsModal.css';

const LIST_COLOR_PRESETS = [
    null,
    '#6b7280',
    '#ef4444',
    '#f97316',
    '#eab308',
    '#22c55e',
    '#14b8a6',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
];

export default function ListDetailsModal({ list, boardId, onSave, onClose }) {
    const [title, setTitle] = useState(list?.title ?? '');
    const [color, setColor] = useState(list?.color ?? null);
    const [isCompletionList, setIsCompletionList] = useState(list?.isCompletionList ?? false);

    useEffect(() => {
        setTitle(list?.title ?? '');
        setColor(list?.color ?? null);
        setIsCompletionList(list?.isCompletionList ?? false);
    }, [list]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({ title: title.trim() || list.title, color: color || null, isCompletionList });
        onClose();
    };

    if (!list) return null;

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="list-details-modal animate-scale-in-centered" onClick={e => e.stopPropagation()}>
                <div className="list-details-header">
                    <h2>Detalhes da lista</h2>
                    <button type="button" className="btn-icon" onClick={onClose}><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="list-details-body">
                    <label className="list-details-field">
                        <span>Nome da lista</span>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Ex: A Fazer"
                        />
                    </label>

                    <label className="list-details-field">
                        <span><Palette size={16} /> Cor da lista</span>
                        <div className="list-details-colors">
                            {LIST_COLOR_PRESETS.map((c) => (
                                <button
                                    key={c ?? 'none'}
                                    type="button"
                                    className={`list-details-color-chip ${color === c ? 'active' : ''} ${!c ? 'list-details-color-none' : ''}`}
                                    style={c ? { background: c } : {}}
                                    title={c ? c : 'Sem cor'}
                                    onClick={() => setColor(c)}
                                >
                                    {color === c && <CheckCircle size={14} color={c ? '#fff' : 'var(--text-secondary)'} />}
                                </button>
                            ))}
                        </div>
                    </label>

                    <label className="list-details-checkbox">
                        <input
                            type="checkbox"
                            checked={isCompletionList}
                            onChange={e => setIsCompletionList(e.target.checked)}
                        />
                        <span><CheckCircle size={16} /> Lista de conclusão</span>
                    </label>
                    <p className="list-details-hint">
                        Se ativado, cards nesta lista contam como concluídos no Overview e, ao mover um card para cá, todas as subtarefas são marcadas automaticamente.
                    </p>

                    <div className="list-details-actions">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="btn btn-primary">Salvar</button>
                    </div>
                </form>
            </div>
        </>
    );
}
