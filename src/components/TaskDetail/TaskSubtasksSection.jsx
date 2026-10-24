/** Subtarefas do card: progresso, marcar/editar/remover e adicionar (respeita o limite por card). */
import { useEffect, useRef, useState } from 'react';
import { CheckSquare, Edit3, Trash2, Plus } from 'lucide-react';
import { TEXT, COUNT } from '@dailyways/limits';
import { LIMIT_MSG } from '../../limits/messages.js';
import { useToast } from '../../context/ToastContext';
import { ph } from './taskDetailConstants';

export default function TaskSubtasksSection({ subtasks, boardId, listId, cardId, collabDispatch, hoverByEl }) {
    const { addToast } = useToast();
    const [newSubtask, setNewSubtask] = useState('');
    const [editingSubtaskId, setEditingSubtaskId] = useState(null);
    const [editingSubtaskTitle, setEditingSubtaskTitle] = useState('');
    const subtaskInputRef = useRef(null);
    const editInputRef = useRef(null);

    useEffect(() => {
        if (editingSubtaskId && editInputRef.current) {
            editInputRef.current.focus();
        }
    }, [editingSubtaskId]);

    const handleAddSubtask = (e) => {
        e.preventDefault();
        if (!newSubtask.trim()) return;
        if (subtasks.length >= COUNT.subtasksPerCard) {
            addToast(LIMIT_MSG.subtasks, 'error');
            return;
        }
        collabDispatch({
            type: 'ADD_SUBTASK',
            payload: { boardId, listId, cardId, title: newSubtask.trim() },
        });
        setNewSubtask('');
        subtaskInputRef.current?.focus();
    };

    const handleToggleSubtask = (subtaskId) => {
        collabDispatch({
            type: 'TOGGLE_SUBTASK',
            payload: { boardId, listId, cardId, subtaskId },
        });
    };

    const handleDeleteSubtask = (subtaskId) => {
        collabDispatch({
            type: 'DELETE_SUBTASK',
            payload: { boardId, listId, cardId, subtaskId },
        });
    };

    const startEditSubtask = (st) => {
        setEditingSubtaskId(st.id);
        setEditingSubtaskTitle(st.title);
    };

    const saveEditSubtask = () => {
        if (editingSubtaskId && editingSubtaskTitle.trim()) {
            collabDispatch({
                type: 'UPDATE_SUBTASK',
                payload: {
                    boardId,
                    listId,
                    cardId,
                    subtaskId: editingSubtaskId,
                    updates: {
                        title: editingSubtaskTitle.trim(),
                        updatedAt: new Date().toISOString(),
                    },
                },
            });
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

    const doneCount = subtasks.filter(st => st.done).length;
    const progress = subtasks.length > 0 ? (doneCount / subtasks.length) * 100 : 0;

    return (
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
                            type="button"
                            {...ph(hoverByEl, `subtask-check-${st.id}`, `task-detail-checkbox ${st.done ? 'checked' : ''}`)}
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
                    {...ph(hoverByEl, 'subtask-add', '')}
                    placeholder="Adicionar subtarefa..."
                    value={newSubtask}
                    maxLength={TEXT.subtaskTitle}
                    onChange={e => setNewSubtask(e.target.value)}
                />
            </form>
        </div>
    );
}
