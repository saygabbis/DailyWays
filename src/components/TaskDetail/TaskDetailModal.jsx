import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabaseClient';
import {
    X, Tag, AlertCircle, Sun, CheckSquare,
    Plus, Trash2, Edit3, Repeat, Clock, ImagePlus,
    Link as LinkIcon, MessageSquare, History, UserPlus, Paperclip, Upload,
    Download, Send, ChevronDown, Ban
} from 'lucide-react';
import './TaskDetail.css';
import { colorFromUserId, initialFromName } from '../../utils/userColor';
import { uuidv4 } from '../../utils/uuid';
import {
    fetchAttachments,
    uploadAttachment,
    createLinkAttachment,
    removeAttachment,
    setCardCover,
    clearCardCover,
    subscribeToAttachments,
    renameAttachment,
} from '../../services/attachmentService';
import { fetchComments, createComment, softDeleteComment, subscribeToComments } from '../../services/commentService';
import { fetchActivity, createActivity, formatActivityText, subscribeToActivity } from '../../services/activityService';
import { fetchAssignees, fetchBoardCandidates, assignUser, removeUser, subscribeToAssignees } from '../../services/assigneeService';
import TaskDateTimeField from '../Common/TaskDateTimeField';

const RECURRENCE_OPTIONS = [
    { value: 'none', label: 'Não repetir' },
    { value: 'daily', label: 'Diariamente' },
    { value: 'weekdays', label: 'Dias úteis' },
    { value: 'weekly', label: 'Semanalmente' },
    { value: 'monthly', label: 'Mensalmente' },
    { value: 'yearly', label: 'Anualmente' },
];

export default function TaskDetailModal({ card, boardId, listId, onClose }) {
    const { dispatch, LABEL_COLORS, state, persistBoard, showConfirm } = useApp();
    const { user } = useAuth();

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
    const [startDate, setStartDate] = useState(liveCard.startDate || null);
    const [dueDate, setDueDate] = useState(liveCard.dueDate || null);
    const [recurrenceRule, setRecurrenceRule] = useState(liveCard.recurrenceRule || 'none');
    const [showRecurrenceMenu, setShowRecurrenceMenu] = useState(false);
    const [isAllDay, setIsAllDay] = useState(liveCard.isAllDay ?? true);
    const [myDay, setMyDay] = useState(liveCard.myDay);
    const [labels, setLabels] = useState(liveCard.labels || []);
    const [cardColor, setCardColor] = useState(liveCard.color || null);
    const [newSubtask, setNewSubtask] = useState('');
    const [editingSubtaskId, setEditingSubtaskId] = useState(null);
    const [editingSubtaskTitle, setEditingSubtaskTitle] = useState('');
    const [showAddLabel, setShowAddLabel] = useState(false);
    const [newLabelName, setNewLabelName] = useState('');
    const [newLabelColor, setNewLabelColor] = useState('#2ec4b6');
    const [attachments, setAttachments] = useState([]);
    const [comments, setComments] = useState([]);
    const [activity, setActivity] = useState([]);
    const [assignees, setAssignees] = useState([]);
    const [boardCandidates, setBoardCandidates] = useState([]);
    const [commentBody, setCommentBody] = useState('');
    const [linkUrl, setLinkUrl] = useState('');
    const [linkLabel, setLinkLabel] = useState('');
    const [showLinkForm, setShowLinkForm] = useState(false);
    const [loadingDomains, setLoadingDomains] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [savingComment, setSavingComment] = useState(false);
    const [savingAssignee, setSavingAssignee] = useState(false);
    const [attachmentError, setAttachmentError] = useState('');
    const [editingAttachmentId, setEditingAttachmentId] = useState(null);
    const [attachmentDrafts, setAttachmentDrafts] = useState({});
    const [showCoverPanel, setShowCoverPanel] = useState(false);

    const subtaskInputRef = useRef(null);
    const editInputRef = useRef(null);
    const fileInputRef = useRef(null);
    const recurrenceMenuRef = useRef(null);
    const coverPanelRef = useRef(null);
    const labelPopoverRef = useRef(null);

    const board = state.boards.find((item) => item.id === boardId);
    const coverAttachment = attachments.find((item) => item.id === liveCard.coverAttachmentId) || null;
    const imageAttachments = attachments.filter((item) => item.kind === 'image' && item.publicUrl);
    const visibleComments = comments.filter((item) => !item.deletedAt);
    const recurrenceLabel = RECURRENCE_OPTIONS.find((item) => item.value === recurrenceRule)?.label || 'Não repetir';

    const assigneeProfiles = assignees.map((item) => {
        const candidate = boardCandidates.find((candidateItem) => candidateItem.userId === item.userId);
        return {
            ...item,
            name: candidate?.name || candidate?.username || 'Usuário',
            photoUrl: candidate?.photo_url || '',
            avatar: candidate?.avatar || initialFromName(candidate?.name || candidate?.username || 'U'),
        };
    });

    useEffect(() => {
        if (editingSubtaskId && editInputRef.current) {
            editInputRef.current.focus();
        }
    }, [editingSubtaskId]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            dispatch({
                type: 'UPDATE_CARD',
                payload: {
                    boardId, listId, cardId: card.id,
                    updates: {
                        title,
                        description,
                        priority,
                        startDate: startDate || null,
                        dueDate: dueDate || null,
                        recurrenceRule: recurrenceRule === 'none' ? null : recurrenceRule,
                        isAllDay,
                        myDay,
                        labels,
                        color: cardColor || null,
                        updatedAt: new Date().toISOString(),
                    }
                },
            });
            persistBoard(boardId);
        }, 300);
        return () => clearTimeout(timeout);
    }, [title, description, priority, startDate, dueDate, recurrenceRule, isAllDay, myDay, labels, cardColor, boardId, listId, card.id, dispatch, persistBoard]);

    useEffect(() => {
        if (!boardId || !card?.id || !user?.id) return;

        const channelName = `board-presence:${boardId}`;
        const channel = supabase.channel(channelName, {
            config: { presence: { key: user.id } },
        });

        const payload = {
            cardId: card.id,
            name: user.name || user.email || user.id,
            photoUrl: user.photo_url || null,
            avatarInitial: initialFromName(user.name || user.email || user.id),
            color: colorFromUserId(user.id),
        };

        const handleSub = (status) => {
            const raw = typeof status === 'string' ? status : status?.status;
            if (raw !== 'SUBSCRIBED') return;
            try {
                channel.track(payload);
            } catch (_) { }
        };

        channel.subscribe(handleSub);

        return () => {
            try {
                channel.untrack?.();
            } catch (_) { }
            try {
                supabase.removeChannel(channel);
            } catch (_) { }
        };
    }, [boardId, card?.id, user?.id, user?.name, user?.email, user?.photo_url]);

    useEffect(() => {
        let active = true;

        async function loadDomains() {
            setLoadingDomains(true);
            const [attachmentsResult, commentsResult, activityResult, assigneesResult, candidatesResult] = await Promise.all([
                fetchAttachments(card.id),
                fetchComments(card.id),
                fetchActivity(card.id),
                fetchAssignees(card.id),
                fetchBoardCandidates(boardId),
            ]);

            if (!active) return;
            setAttachments(attachmentsResult.data || []);
            setComments(commentsResult.data || []);
            setActivity(activityResult.data || []);
            setAssignees(assigneesResult.data || []);
            setBoardCandidates(candidatesResult.data || []);
            setLoadingDomains(false);
        }

        loadDomains();

        const unsubAttachments = subscribeToAttachments(card.id, () => fetchAttachments(card.id).then((result) => active && setAttachments(result.data || [])));
        const unsubComments = subscribeToComments(card.id, () => fetchComments(card.id).then((result) => active && setComments(result.data || [])));
        const unsubActivity = subscribeToActivity(card.id, () => fetchActivity(card.id).then((result) => active && setActivity(result.data || [])));
        const unsubAssignees = subscribeToAssignees(card.id, () => fetchAssignees(card.id).then((result) => active && setAssignees(result.data || [])));

        return () => {
            active = false;
            unsubAttachments();
            unsubComments();
            unsubActivity();
            unsubAssignees();
        };
    }, [card.id, boardId]);

    useEffect(() => {
        function handleOutsideClick(event) {
            if (recurrenceMenuRef.current && !recurrenceMenuRef.current.contains(event.target)) {
                setShowRecurrenceMenu(false);
            }
            if (coverPanelRef.current && !coverPanelRef.current.contains(event.target)) {
                setShowCoverPanel(false);
            }
            if (labelPopoverRef.current && !labelPopoverRef.current.contains(event.target)) {
                setShowAddLabel(false);
            }
        }
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    const handleDelete = async () => {
        const confirmed = await showConfirm({
            title: 'Deletar Tarefa',
            message: `Tem certeza que deseja deletar "${card.title}"?`,
            confirmLabel: 'Deletar',
            type: 'danger'
        });

        if (confirmed) {
            dispatch({ type: 'DELETE_CARD', payload: { boardId, listId, cardId: card.id } });
            persistBoard(boardId);
            onClose();
        }
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
            id: uuidv4(),
            name: newLabelName.trim(),
            color: newLabelColor
        };
        dispatch({ type: 'ADD_LABEL', payload: newLabel });
        setLabels(prev => [...prev, newLabel.id]);
        setNewLabelName('');
        setShowAddLabel(false);
    };

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
                            st.id === editingSubtaskId
                                ? { ...st, title: editingSubtaskTitle.trim(), updatedAt: new Date().toISOString() }
                                : st
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

    const handleUploadFiles = async (event) => {
        const files = Array.from(event.target.files || []);
        if (!files.length || !user?.id) return;

        setAttachmentError('');
        setUploading(true);
        for (const file of files) {
            const result = await uploadAttachment(card.id, file, user.id);
            if (result.success) {
                await createActivity(card.id, user.id, 'attachment_added', { fileName: file.name });
                if (file.type?.startsWith('image/') && !liveCard.coverAttachmentId) {
                    await handleSetCover({ id: result.data.id });
                }
            } else {
                setAttachmentError(result.error || 'Não foi possível adicionar o anexo.');
            }
        }
        setUploading(false);
        event.target.value = '';
    };

    const handleAddLink = async (event) => {
        event.preventDefault();
        if (!linkUrl.trim() || !user?.id) return;

        const result = await createLinkAttachment(card.id, linkUrl.trim(), linkLabel.trim(), user.id);
        if (result.success) {
            await createActivity(card.id, user.id, 'attachment_added', { linkUrl: linkUrl.trim() });
            setLinkUrl('');
            setLinkLabel('');
            setShowLinkForm(false);
        } else {
            setAttachmentError(result.error || 'Não foi possível salvar o link.');
        }
    };

    const handleRemoveAttachment = async (attachment) => {
        const confirmed = await showConfirm({
            title: 'Remover anexo',
            message: `Tem certeza que deseja remover "${attachment.fileName || attachment.linkLabel || 'este anexo'}"?`,
            confirmLabel: 'Remover',
            type: 'danger',
        });

        if (!confirmed) return;

        const result = await removeAttachment(attachment);
        if (result.success && user?.id) {
            setAttachments((prev) => prev.filter((item) => item.id !== attachment.id));
            if (liveCard.coverAttachmentId === attachment.id) {
                dispatch({
                    type: 'UPDATE_CARD',
                    payload: {
                        boardId,
                        listId,
                        cardId: card.id,
                        updates: { coverAttachmentId: null, updatedAt: new Date().toISOString() },
                    },
                });
                persistBoard(boardId);
            }
            await createActivity(card.id, user.id, 'attachment_removed', { attachmentId: attachment.id });
        } else if (!result.success) {
            setAttachmentError(result.error || 'Não foi possível remover o anexo.');
        }
    };

    const handleSetCover = async (attachment) => {
        const result = await setCardCover(card.id, attachment.id);
        if (result.success) {
            dispatch({
                type: 'UPDATE_CARD',
                payload: {
                    boardId,
                    listId,
                    cardId: card.id,
                    updates: { coverAttachmentId: attachment.id, updatedAt: new Date().toISOString() },
                },
            });
            persistBoard(boardId);
            setShowCoverPanel(false);
            if (user?.id) await createActivity(card.id, user.id, 'cover_set', { attachmentId: attachment.id });
        } else {
            setAttachmentError(result.error || 'Não foi possível definir a capa.');
        }
    };

    const handleClearCover = async () => {
        const result = await clearCardCover(card.id);
        if (result.success) {
            dispatch({
                type: 'UPDATE_CARD',
                payload: {
                    boardId,
                    listId,
                    cardId: card.id,
                    updates: { coverAttachmentId: null, updatedAt: new Date().toISOString() },
                },
            });
            persistBoard(boardId);
            setShowCoverPanel(false);
            if (user?.id) await createActivity(card.id, user.id, 'cover_cleared', {});
        } else {
            setAttachmentError(result.error || 'Não foi possível remover a capa.');
        }
    };

    const handleAttachmentDraftChange = (attachmentId, field, value) => {
        setAttachmentDrafts((prev) => ({
            ...prev,
            [attachmentId]: {
                ...(prev[attachmentId] || {}),
                [field]: value,
            },
        }));
    };

    const handleSaveAttachmentMeta = async (attachment) => {
        const draft = attachmentDrafts[attachment.id] || {};
        const result = await renameAttachment(attachment.id, {
            fileName: draft.fileName ?? attachment.fileName,
            description: draft.description ?? attachment.description,
        });

        if (result.success) {
            setAttachments((prev) => prev.map((item) => item.id === attachment.id ? {
                ...item,
                fileName: draft.fileName ?? item.fileName,
                description: draft.description ?? item.description,
                linkLabel: draft.description ?? item.linkLabel,
            } : item));
            setEditingAttachmentId(null);
        } else {
            setAttachmentError(result.error || 'Não foi possível atualizar o anexo.');
        }
    };

    const handleCreateComment = async (event) => {
        event.preventDefault();
        if (!commentBody.trim() || !user?.id) return;

        setSavingComment(true);
        const result = await createComment(card.id, commentBody.trim(), user.id);
        if (result.success) {
            await createActivity(card.id, user.id, 'comment_added', {});
            setCommentBody('');
        }
        setSavingComment(false);
    };

    const handleDeleteComment = async (commentId) => {
        const confirmed = await showConfirm({
            title: 'Remover comentário',
            message: 'Tem certeza que deseja remover este comentário?',
            confirmLabel: 'Remover',
            type: 'danger',
        });
        if (!confirmed) return;

        const result = await softDeleteComment(commentId);
        if (result.success && user?.id) {
            setComments((prev) => prev.map((item) => item.id === commentId ? { ...item, deletedAt: new Date().toISOString() } : item));
            await createActivity(card.id, user.id, 'comment_deleted', { commentId });
        }
    };

    const handleAssignUser = async (event) => {
        const nextUserId = event.target.value;
        if (!nextUserId || !user?.id) return;

        setSavingAssignee(true);
        const result = await assignUser(card.id, nextUserId, user.id);
        if (result.success) {
            await createActivity(card.id, user.id, 'assignee_added', { userId: nextUserId });
        }
        setSavingAssignee(false);
        event.target.value = '';
    };

    const handleRemoveAssignee = async (userIdToRemove) => {
        const result = await removeUser(card.id, userIdToRemove);
        if (result.success && user?.id) {
            setAssignees((prev) => prev.filter((item) => item.userId !== userIdToRemove));
            await createActivity(card.id, user.id, 'assignee_removed', { userId: userIdToRemove });
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

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    return createPortal(
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="task-detail-modal animate-scale-in-centered">
                {coverAttachment?.publicUrl && (
                    <div className="task-detail-cover">
                        <img src={coverAttachment.publicUrl} alt={coverAttachment.fileName || liveCard.title} />
                    </div>
                )}

                <div className="task-detail-header">
                    <h2>Detalhes da Tarefa</h2>
                    <button className="btn-icon" onClick={onClose} title="Fechar">
                        <X size={20} />
                    </button>
                </div>

                <div className="task-detail-layout">
                    <div className="task-detail-body">
                        <input
                            type="text"
                            className="task-detail-title"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Título da tarefa..."
                        />

                        <textarea
                            className="task-detail-desc"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Adicionar descrição..."
                            rows={4}
                        />

                        <div className="task-detail-quick-actions">
                            <button
                                className={`task-detail-quick-btn ${myDay ? 'active' : ''}`}
                                onClick={() => setMyDay(!myDay)}
                            >
                                <Sun size={16} />
                                <span>{myDay ? 'Meu Dia ✓' : 'Meu Dia'}</span>
                            </button>
                            <button
                                className="task-detail-quick-btn"
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                            >
                                <Upload size={16} />
                                <span>{uploading ? 'Enviando...' : 'Adicionar arquivo'}</span>
                            </button>
                            <button
                                className={`task-detail-quick-btn ${showLinkForm ? 'active' : ''}`}
                                type="button"
                                onClick={() => setShowLinkForm(prev => !prev)}
                            >
                                <LinkIcon size={16} />
                                <span>Adicionar link</span>
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                hidden
                                onChange={handleUploadFiles}
                            />
                        </div>

                        <div className="task-detail-field" style={{ marginTop: 10 }}>
                            <label><Tag size={15} /> Cor do card</label>
                            <div className="task-detail-color-row">
                                {[null, '#6b7280', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '__glass__'].map((c) => {
                                    const isGlass = c === '__glass__';
                                    const key = c ?? (isGlass ? 'glass' : 'none');
                                    const isActive = cardColor === c;
                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            className={`task-detail-color-chip ${isActive ? 'active' : ''} ${!c ? 'none' : ''} ${isGlass ? 'glass' : ''}`}
                                            style={!isGlass && c ? { background: c } : {}}
                                            title={isGlass ? 'Vidro (usa a cor da lista)' : (c ?? 'Sem cor')}
                                            onClick={() => setCardColor(c)}
                                        >
                                            {isGlass && <span className="task-detail-color-glass-dot" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="task-detail-fields task-detail-fields-compact">
                            <TaskDateTimeField
                                label="Início"
                                value={startDate}
                                onChange={setStartDate}
                                isAllDay={isAllDay}
                                onToggleAllDay={() => setIsAllDay((prev) => !prev)}
                            />

                            <TaskDateTimeField
                                label="Fim"
                                value={dueDate}
                                onChange={setDueDate}
                                isAllDay={isAllDay}
                                onToggleAllDay={() => setIsAllDay((prev) => !prev)}
                            />

                            <div className="task-detail-field task-detail-field-full">
                                <label><Repeat size={15} /> Repetir</label>
                                <div className="task-detail-menu-wrap" ref={recurrenceMenuRef}>
                                    <button type="button" className="task-detail-menu-trigger" onClick={() => setShowRecurrenceMenu((prev) => !prev)}>
                                        <span>{recurrenceLabel}</span>
                                        <ChevronDown size={14} />
                                    </button>
                                    {showRecurrenceMenu && (
                                        <div className="task-detail-menu-dropdown">
                                            {RECURRENCE_OPTIONS.map((option) => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    className={`task-detail-menu-option ${recurrenceRule === option.value ? 'active' : ''}`}
                                                    onClick={() => {
                                                        setRecurrenceRule(option.value);
                                                        setShowRecurrenceMenu(false);
                                                    }}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="task-detail-field task-detail-field-full">
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

                            {showAddLabel && (
                                <div className="label-popover animate-pop-in label-popover-floating" ref={labelPopoverRef}>
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
                                        <button
                                            type="button"
                                            className="color-dot color-dot-custom"
                                            onClick={() => document.getElementById('task-label-custom-color')?.click()}
                                        >
                                            <Plus size={12} />
                                        </button>
                                        <input
                                            id="task-label-custom-color"
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

                        <div className="task-detail-section">
                            <div className="task-detail-section-header">
                                <h3><Paperclip size={16} /> Anexos</h3>
                                <span>{attachments.length}</span>
                            </div>

                            {showLinkForm && (
                                <form className="task-detail-link-form" onSubmit={handleAddLink}>
                                    <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." />
                                    <input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Nome opcional" />
                                    <button className="btn btn-primary btn-sm" type="submit">Salvar link</button>
                                </form>
                            )}

                            <div className="task-detail-attachments-grid task-detail-attachments-list">
                                {attachments.map((attachment) => {
                                    const draft = attachmentDrafts[attachment.id] || {};
                                    const isEditing = editingAttachmentId === attachment.id;
                                    return (
                                        <div key={attachment.id} className="task-detail-attachment-row">
                                            {attachment.kind === 'image' && attachment.publicUrl ? (
                                                <img src={attachment.publicUrl} alt={attachment.fileName || 'Imagem'} className="task-detail-attachment-thumb" />
                                            ) : (
                                                <div className="task-detail-attachment-placeholder">
                                                    {attachment.kind === 'link' ? <LinkIcon size={18} /> : <Paperclip size={18} />}
                                                </div>
                                            )}

                                            <div className="task-detail-attachment-info">
                                                {isEditing ? (
                                                    <>
                                                        <input
                                                            className="task-detail-inline-input"
                                                            value={draft.fileName ?? attachment.fileName ?? ''}
                                                            onChange={(e) => handleAttachmentDraftChange(attachment.id, 'fileName', e.target.value)}
                                                            placeholder="Nome do anexo"
                                                        />
                                                        <input
                                                            className="task-detail-inline-input"
                                                            value={draft.description ?? attachment.description ?? ''}
                                                            onChange={(e) => handleAttachmentDraftChange(attachment.id, 'description', e.target.value)}
                                                            placeholder="Descrição"
                                                        />
                                                        <div className="task-detail-inline-actions">
                                                            <button type="button" className="btn btn-primary btn-xs" onClick={() => handleSaveAttachmentMeta(attachment)}>Salvar</button>
                                                            <button type="button" className="btn btn-secondary btn-xs" onClick={() => setEditingAttachmentId(null)}>Cancelar</button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <strong>{attachment.fileName || attachment.linkLabel || 'Anexo'}</strong>
                                                        <span>{attachment.description || attachment.mimeType || attachment.kind}</span>
                                                    </>
                                                )}
                                            </div>

                                            <div className="task-detail-attachment-actions-inline">
                                                {attachment.publicUrl && (
                                                    <a className="btn-icon" href={attachment.publicUrl} download={attachment.fileName || 'anexo'} title="Baixar">
                                                        <Download size={16} />
                                                    </a>
                                                )}
                                                <button type="button" className="btn-icon" title="Editar nome e descrição" onClick={() => {
                                                    setEditingAttachmentId(attachment.id);
                                                    setAttachmentDrafts((prev) => ({
                                                        ...prev,
                                                        [attachment.id]: {
                                                            fileName: attachment.fileName || '',
                                                            description: attachment.description || '',
                                                        },
                                                    }));
                                                }}>
                                                    <Edit3 size={16} />
                                                </button>
                                                <button type="button" className="btn-icon danger" title="Remover" onClick={() => handleRemoveAttachment(attachment)}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}

                                {!attachments.length && !loadingDomains && (
                                    <button type="button" className="task-detail-empty task-detail-empty-upload" onClick={() => fileInputRef.current?.click()}>
                                        <Upload size={16} />
                                        <span>{uploading ? 'Enviando...' : 'Clique aqui para adicionar arquivo ou imagem'}</span>
                                    </button>
                                )}
                            </div>
                            {attachmentError && <div className="task-detail-error">{attachmentError}</div>}
                        </div>

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

                    <aside className="task-detail-sidebar">
                        <div className="task-detail-section task-detail-cover-panel" ref={coverPanelRef}>
                            <div className="task-detail-section-header">
                                <h3><ImagePlus size={16} /> Capa</h3>
                                <button type="button" className="btn-icon" onClick={() => setShowCoverPanel((prev) => !prev)}>
                                    <ChevronDown size={16} className={showCoverPanel ? 'rotated' : ''} />
                                </button>
                            </div>
                            {showCoverPanel && (
                                <div className="task-detail-cover-menu">
                                    {imageAttachments.length > 0 ? (
                                        <>
                                            <div className="task-detail-cover-thumbs">
                                                {imageAttachments.map((attachment) => (
                                                    <button
                                                        key={attachment.id}
                                                        type="button"
                                                        className={`task-detail-cover-thumb ${liveCard.coverAttachmentId === attachment.id ? 'active' : ''}`}
                                                        onClick={() => handleSetCover(attachment)}
                                                    >
                                                        <img src={attachment.publicUrl} alt={attachment.fileName || 'Imagem'} />
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="task-detail-cover-actions-row">
                                                {liveCard.coverAttachmentId && (
                                                    <button type="button" className="btn btn-secondary btn-sm" onClick={handleClearCover}>Remover capa</button>
                                                )}
                                                <button type="button" className="btn-icon" title="Sem capa" onClick={handleClearCover}>
                                                    <Ban size={16} />
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="task-detail-empty">Envie uma imagem para definir como capa.</div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="task-detail-section">
                            <div className="task-detail-section-header">
                                <h3><UserPlus size={16} /> Responsáveis</h3>
                            </div>
                            <select className="task-detail-select" onChange={handleAssignUser} disabled={savingAssignee} defaultValue="">
                                <option value="">Adicionar responsável</option>
                                {boardCandidates
                                    .filter((candidate) => !assignees.some((item) => item.userId === candidate.userId))
                                    .map((candidate) => (
                                        <option key={candidate.userId} value={candidate.userId}>
                                            {candidate.name || candidate.username || candidate.userId}
                                        </option>
                                    ))}
                            </select>
                            <div className="task-detail-assignee-list">
                                {assigneeProfiles.map((assignee) => (
                                    <div key={assignee.userId} className="task-detail-assignee-item">
                                        <div className="task-detail-assignee-avatar">
                                            {assignee.photoUrl ? <img src={assignee.photoUrl} alt={assignee.name} /> : <span>{assignee.avatar}</span>}
                                        </div>
                                        <div className="task-detail-assignee-meta">
                                            <strong>{assignee.name}</strong>
                                            <span>{assignee.role || 'membro'}</span>
                                        </div>
                                        <button type="button" className="btn-icon btn-xs" onClick={() => handleRemoveAssignee(assignee.userId)}>
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ))}
                                {!assigneeProfiles.length && !loadingDomains && <div className="task-detail-empty">Sem responsáveis.</div>}
                            </div>
                        </div>

                        <div className="task-detail-section">
                            <div className="task-detail-section-header">
                                <h3><MessageSquare size={16} /> Comentários</h3>
                                <span>{visibleComments.length}</span>
                            </div>
                            <form className="task-detail-comment-composer" onSubmit={handleCreateComment}>
                                <div className="task-detail-comment-box">
                                    <button type="button" className="btn-icon" title="Adicionar">
                                        <Plus size={18} />
                                    </button>
                                    <textarea
                                        value={commentBody}
                                        onChange={(e) => setCommentBody(e.target.value)}
                                        placeholder="Digite uma mensagem"
                                        rows={1}
                                    />
                                    <button className="task-detail-send-btn" type="submit" disabled={savingComment || !commentBody.trim()} title="Enviar comentário">
                                        <Send size={16} />
                                    </button>
                                </div>
                            </form>
                            <div className="task-detail-comment-list">
                                {comments.map((comment) => {
                                    const author = comment.authorId === user?.id
                                        ? { name: user?.name || 'Você', photoUrl: user?.photo_url || '', avatar: initialFromName(user?.name || 'V') }
                                        : boardCandidates.find((candidate) => candidate.userId === comment.authorId) || null;

                                    return (
                                        <div key={comment.id} className={`task-detail-comment-item ${comment.deletedAt ? 'deleted' : ''}`}>
                                            <div className="task-detail-comment-avatar">
                                                {author?.photoUrl ? <img src={author.photoUrl} alt={author.name} /> : <span>{author?.avatar || initialFromName(author?.name || 'U')}</span>}
                                            </div>
                                            <div className="task-detail-comment-content">
                                                <div className="task-detail-comment-head">
                                                    <strong>{author?.name || 'Usuário'}</strong>
                                                    {!comment.deletedAt && <button type="button" className="btn-icon btn-xs" onClick={() => handleDeleteComment(comment.id)}><Trash2 size={12} /></button>}
                                                </div>
                                                <p>{comment.deletedAt ? 'Comentário removido.' : comment.body}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                                {!comments.length && !loadingDomains && <div className="task-detail-empty">Nenhum comentário ainda.</div>}
                            </div>
                        </div>

                        <div className="task-detail-section">
                            <div className="task-detail-section-header">
                                <h3><History size={16} /> Activity</h3>
                                <span>{activity.length}</span>
                            </div>
                            <div className="task-detail-activity-list">
                                {activity.map((item) => (
                                    <div key={item.id} className="task-detail-activity-item">
                                        <History size={14} />
                                        <span>{formatActivityText(item)}</span>
                                    </div>
                                ))}
                                {!activity.length && !loadingDomains && <div className="task-detail-empty">Nenhuma atividade registrada.</div>}
                            </div>
                        </div>
                    </aside>
                </div>

                <div className="task-detail-footer">
                    <button className="btn btn-danger btn-sm" onClick={handleDelete}>
                        <Trash2 size={14} /> Deletar
                    </button>
                    <div className="task-detail-footer-info">
                        Alterações salvas automaticamente
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
}
