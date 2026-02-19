import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
    X, Calendar, Tag, AlertCircle, Sun, CheckSquare,
    Plus, Trash2, Edit3, GripVertical, Repeat, Clock
} from 'lucide-react';
import './TaskDetail.css';

export default function TaskDetailModal({ card, boardId, listId, onClose }) {
    const { dispatch, LABEL_COLORS, state, persistBoard } = useApp();

    // Get the LIVE card data from state (not the stale prop)
    const liveCard = (() => {
        const board = state.boards.find(b => b.id === boardId);
        if (!board) return card;
        const list = board.lists.find(l => l.id === listId);
        if (!list) return card;
        return list.cards.find(c => c.id === card.id) || card;
    })();

    const [title, setTitle] = useState(liveCard.title);
    const [description, setDescription] = useState(liveCard.description || '');
    const [priority, setPriority] = useState(liveCard.priority || 'none');
    const [dueDate, setDueDate] = useState(liveCard.dueDate || '');
    const [startDate, setStartDate] = useState(liveCard.startDate || '');
    const [recurrence, setRecurrence] = useState(liveCard.recurrence || 'none');
    const [myDay, setMyDay] = useState(liveCard.myDay);
    const [labels, setLabels] = useState(liveCard.labels || []);
    const [newSubtask, setNewSubtask] = useState('');
    const [editingSubtaskId, setEditingSubtaskId] = useState(null);
    const [editingSubtaskTitle, setEditingSubtaskTitle] = useState('');

    // New Label State
    const [showAddLabel, setShowAddLabel] = useState(false);
    const [newLabelName, setNewLabelName] = useState('');
    const [newLabelColor, setNewLabelColor] = useState('#2ec4b6');

    const subtaskInputRef = useRef(null);
    const editInputRef = useRef(null);

    // Focus edit input when editing starts
    useEffect(() => {
        if (editingSubtaskId && editInputRef.current) {
            editInputRef.current.focus();
        }
    }, [editingSubtaskId]);

    // Auto-save on field changes (real-time updates)
    useEffect(() => {
        const timeout = setTimeout(() => {
            dispatch({
                type: 'UPDATE_CARD',
                payload: {
                    boardId, listId, cardId: card.id,
                    updates: {
                        title, description, priority,
                        dueDate: dueDate || null,
                        startDate: startDate || null,
                        recurrence: recurrence === 'none' ? null : recurrence,
                        myDay, labels
                    }
                },
            });
            // Persistir mudanças de texto/campos
            persistBoard(boardId);
        }, 300);
        return () => clearTimeout(timeout);
    }, [title, description, priority, dueDate, myDay, labels]);

    const handleDelete = () => {
        dispatch({ type: 'DELETE_CARD', payload: { boardId, listId, cardId: card.id } });
        persistBoard(boardId);
        onClose();
    };

    const toggleLabel = (labelId) => {
        const newLabels = labels.includes(labelId)
            ? labels.filter(l => l !== labelId)
            : [...labels, labelId];
        setLabels(newLabels);
    };

    const handleAddLabel = (e) => {
        e.preventDefault();
        if (!newLabelName.trim()) return;
        const newLabel = {
            id: crypto.randomUUID(),
            name: newLabelName.trim(),
            color: newLabelColor
        };
        dispatch({ type: 'ADD_LABEL', payload: newLabel });
        setLabels(prev => [...prev, newLabel.id]); // Auto-select msg
        setNewLabelName('');
        setShowAddLabel(false);
    };

    // ── Subtask operations (all dispatch and persist immediately) ──
    const handleAddSubtask = (e) => {
        e.preventDefault();
        if (!newSubtask.trim()) return;
        dispatch({
            type: 'ADD_SUBTASK',
            payload: { boardId, listId, cardId: card.id, title: newSubtask.trim() },
        });
        persistBoard(boardId);
        setNewSubtask('');
        subtaskInputRef.current?.focus();
    };

    const handleToggleSubtask = (subtaskId) => {
        dispatch({
            type: 'TOGGLE_SUBTASK',
            payload: { boardId, listId, cardId: card.id, subtaskId },
        });
        persistBoard(boardId);
    };

    const handleDeleteSubtask = (subtaskId) => {
        dispatch({
            type: 'DELETE_SUBTASK',
            payload: { boardId, listId, cardId: card.id, subtaskId },
        });
        persistBoard(boardId);
    };

    const startEditSubtask = (st) => {
        setEditingSubtaskId(st.id);
        setEditingSubtaskTitle(st.title);
    };

    const saveEditSubtask = () => {
        if (editingSubtaskId && editingSubtaskTitle.trim()) {
            dispatch({
                type: 'UPDATE_CARD',
                payload: {
                    boardId, listId, cardId: card.id,
                    updates: {
                        subtasks: liveCard.subtasks.map(st =>
                            st.id === editingSubtaskId ? { ...st, title: editingSubtaskTitle.trim() } : st
                        )
                    }
                },
            });
            persistBoard(boardId);
        }
        setEditingSubtaskId(null);
        setEditingSubtaskTitle('');
    };

    const handleEditSubtaskKeyDown = (e) => {
        if (e.key === 'Enter') saveEditSubtask();
        if (e.key === 'Escape') {
            setEditingSubtaskId(null);
            setEditingSubtaskTitle('');
        }
    };

    const subtasks = liveCard.subtasks || [];
    const doneCount = subtasks.filter(st => st.done).length;
    const progress = subtasks.length > 0 ? (doneCount / subtasks.length) * 100 : 0;

    const priorities = [
        { value: 'none', label: 'Nenhuma', color: 'var(--text-tertiary)' },
        { value: 'low', label: 'Baixa', color: '#3b82f6' },
        { value: 'medium', label: 'Média', color: '#f59e0b' },
        { value: 'high', label: 'Alta', color: '#f97316' },
        { value: 'urgent', label: 'Urgente', color: '#ef4444' },
    ];

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="task-detail-modal animate-scale-in">
                {/* Header */}
                <div className="task-detail-header">
                    <h2>Detalhes da Tarefa</h2>
                    <button className="btn-icon" onClick={onClose} title="Fechar">
                        <X size={20} />
                    </button>
                </div>

                <div className="task-detail-body">
                    {/* Title */}
                    <input
                        type="text"
                        className="task-detail-title"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="Título da tarefa..."
                    />

                    {/* Description */}
                    <textarea
                        className="task-detail-desc"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Adicionar descrição..."
                        rows={3}
                    />

                    {/* Quick Actions Row */}
                    <div className="task-detail-quick-actions">
                        <button
                            className={`task-detail-quick-btn ${myDay ? 'active' : ''}`}
                            onClick={() => setMyDay(!myDay)}
                        >
                            <Sun size={16} />
                            <span>{myDay ? 'Meu Dia ✓' : 'Meu Dia'}</span>
                        </button>
                    </div>

                    {/* Fields Grid */}
                    <div className="task-detail-fields">
                        {/* Due Date */}
                        <div className="task-detail-field">
                            <label><Calendar size={15} /> Vencimento</label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={e => setDueDate(e.target.value)}
                            />
                        </div>

                        {/* Start Date */}
                        <div className="task-detail-field">
                            <label><Clock size={15} /> Iniciar em</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                            />
                        </div>

                        {/* Recurrence */}
                        <div className="task-detail-field">
                            <label><Repeat size={15} /> Repetir</label>
                            <select
                                value={recurrence}
                                onChange={e => setRecurrence(e.target.value)}
                                className="task-detail-select"
                            >
                                <option value="none">Não repetir</option>
                                <option value="daily">Diariamente</option>
                                <option value="weekdays">Dias úteis</option>
                                <option value="weekly">Semanalmente</option>
                                <option value="monthly">Mensalmente</option>
                                <option value="yearly">Anualmente</option>
                            </select>
                        </div>

                        {/* Priority */}
                        <div className="task-detail-field">
                            <label><AlertCircle size={15} /> Prioridade</label>
                            <div className="task-detail-priority-grid">
                                {priorities.map(p => (
                                    <button
                                        key={p.value}
                                        className={`task-detail-priority-btn ${priority === p.value ? 'active' : ''}`}
                                        style={{ '--priority-color': p.color }}
                                        onClick={() => setPriority(p.value)}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Labels */}
                    <div className="task-detail-field">
                        <label><Tag size={15} /> Labels</label>
                        <div className="task-detail-labels">
                            {LABEL_COLORS.map(l => (
                                <button
                                    key={l.id}
                                    className={`task-detail-label-btn ${labels.includes(l.id) ? 'selected' : ''}`}
                                    style={{ '--label-color': l.color }}
                                    onClick={() => toggleLabel(l.id)}
                                    title={l.name}
                                >
                                    <span className="task-detail-label-dot" />
                                    {l.name}
                                </button>
                            ))}
                            <button
                                className="task-detail-label-btn add-btn"
                                onClick={() => setShowAddLabel(!showAddLabel)}
                                title="Criar nova etiqueta"
                            >
                                <Plus size={14} />
                            </button>
                        </div>

                        {/* Add Label Popover */}
                        {showAddLabel && (
                            <div className="label-popover animate-scale-in">
                                <input
                                    type="text"
                                    placeholder="Nome da etiqueta..."
                                    value={newLabelName}
                                    onChange={e => setNewLabelName(e.target.value)}
                                    autoFocus
                                />
                                <div className="label-colors">
                                    {['#ff6b6b', '#ffa06b', '#ffd93d', '#6bcb77', '#4d96ff', '#9b59b6', '#ff6b9d', '#2ec4b6', '#607d8b', '#34495e'].map(c => (
                                        <button
                                            key={c}
                                            className={`color-dot ${newLabelColor === c ? 'selected' : ''}`}
                                            style={{ background: c }}
                                            onClick={() => setNewLabelColor(c)}
                                        />
                                    ))}
                                    <input
                                        type="color"
                                        value={newLabelColor}
                                        onChange={e => setNewLabelColor(e.target.value)}
                                        className="color-input-tiny"
                                    />
                                </div>
                                <button className="btn btn-primary btn-sm btn-full" onClick={handleAddLabel}>
                                    Criar Etiqueta
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Subtasks */}
                    <div className="task-detail-field task-detail-subtasks-section">
                        <label>
                            <CheckSquare size={15} />
                            Subtarefas
                            {subtasks.length > 0 && (
                                <span className="task-detail-subtask-count">{doneCount}/{subtasks.length}</span>
                            )}
                        </label>

                        {subtasks.length > 0 && (
                            <div className="task-detail-progress">
                                <div
                                    className="task-detail-progress-bar"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        )}

                        <div className="task-detail-subtasks">
                            {subtasks.map(st => (
                                <div key={st.id} className={`task-detail-subtask ${st.done ? 'done' : ''}`}>
                                    <button
                                        className={`task-detail-checkbox ${st.done ? 'checked' : ''}`}
                                        onClick={() => handleToggleSubtask(st.id)}
                                    />
                                    {editingSubtaskId === st.id ? (
                                        <input
                                            ref={editInputRef}
                                            type="text"
                                            className="task-detail-subtask-edit"
                                            value={editingSubtaskTitle}
                                            onChange={e => setEditingSubtaskTitle(e.target.value)}
                                            onBlur={saveEditSubtask}
                                            onKeyDown={handleEditSubtaskKeyDown}
                                        />
                                    ) : (
                                        <span
                                            className="task-detail-subtask-title"
                                            onDoubleClick={() => startEditSubtask(st)}
                                        >
                                            {st.title}
                                        </span>
                                    )}
                                    <div className="task-detail-subtask-actions">
                                        <button className="btn-icon btn-xs" onClick={() => startEditSubtask(st)} title="Editar">
                                            <Edit3 size={12} />
                                        </button>
                                        <button className="btn-icon btn-xs" onClick={() => handleDeleteSubtask(st.id)} title="Remover">
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <form onSubmit={handleAddSubtask} className="task-detail-add-subtask">
                            <Plus size={16} />
                            <input
                                ref={subtaskInputRef}
                                type="text"
                                placeholder="Adicionar subtarefa..."
                                value={newSubtask}
                                onChange={e => setNewSubtask(e.target.value)}
                            />
                        </form>
                    </div>
                </div>

                {/* Footer */}
                <div className="task-detail-footer">
                    <button className="btn btn-danger btn-sm" onClick={handleDelete}>
                        <Trash2 size={14} /> Deletar
                    </button>
                    <div className="task-detail-footer-info">
                        Alterações salvas automaticamente
                    </div>
                </div>
            </div>
        </>
    );
}
