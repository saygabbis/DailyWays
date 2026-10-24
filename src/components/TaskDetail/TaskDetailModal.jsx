import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useBoardCollabDispatch } from '../../collab/board/ops/BoardCollabContext.jsx';
import { useBoardUndo } from '../../hooks/useBoardUndo';
import { DELETE_TASK_CONFIRM_CHECKBOX, isDeleteConfirmPermanent } from '../Board/boardCardBulkOps';
import {
    snapshotFromCard,
    buildCardPersistDelta,
    mergeCardPersistBase,
} from './taskDetailCardPersist';
import { useCollabPresence } from '../../collab/board/presence/useCollabPresence.js';
import { announcePresence } from '../../collab/board/presence/presenceBridge.js';
import { applyTaskModalPresence } from '../../collab/board/presence/boardPresenceFocus.js';
import {
    publishBoardPresenceFull,
    restoreBoardPresenceAfterModal,
    scheduleBoardCursorResyncAfterModal,
} from '../../collab/board/presence/boardPresencePublish.js';
import { isPeerInTaskModal } from '../../collab/board/presence/presenceVisibility.js';
import CollabPresenceLayer from '../../collab/board/ui/CollabPresenceLayer.jsx';
import { useCollab } from '../../collab/core/CollabContext.jsx';
import { usePresenceStore } from '../../collab/board/presence/presenceStore';
import { useTaskModalPeerPresence } from '../../hooks/useTaskModalPeerPresence.js';
import {
    buildTaskModalLiveDraft,
    applyPeerTaskModalDraft,
} from '../../collab/task-modal/taskModalLiveDraft.js';
import { createRemoteSyncLock } from '../../collab/task-modal/taskModalCollabSync.js';
import { useDocumentPointerPresence } from '../../collab/board/presence/useDocumentPointerPresence.js';
import { pointerCoordsFromTaskModalEvent } from '../../collab/board/coords/taskModalCursorCoords.js';

import {
    X,
    Tag,
    AlertCircle,
    Sun,
    Plus,
    Trash2,
    Repeat,
    Link as LinkIcon,
    Upload,
    ChevronDown,
    Ban,
} from 'lucide-react';
import './TaskDetail.css';
import { uuidv4 } from '../../utils/uuid';
import { TEXT, COUNT } from '@dailyways/limits';
import { LIMIT_MSG } from '../../limits/messages.js';
import { useToast } from '../../context/ToastContext';
import TaskDateTimeField from '../Common/TaskDateTimeField';
import { RECURRENCE_OPTIONS, PRIORITY_OPTIONS, ph } from './taskDetailConstants';
import { useTaskCardDomains } from './hooks/useTaskCardDomains';
import TaskDetailSidebar from './TaskDetailSidebar';
import TaskAttachmentsSection from './TaskAttachmentsSection';
import TaskSubtasksSection from './TaskSubtasksSection';

export default function TaskDetailModal({ card, boardId, listId, onClose }) {
    const { dispatch, LABEL_COLORS, state, showConfirm } = useApp();
    const { addToast } = useToast();
    const { collabDispatch } = useBoardCollabDispatch(boardId);
    const { undo: boardUndo, redo: boardRedo } = useBoardUndo(boardId);
    const {
        updateCursor,
        setSelectedCardId,
        setHoverModalEl,
        setLiveDraft,
    } = useCollabPresence(boardId, { mode: 'screen' });
    const collab = useCollab();
    const modalRef = useRef(null);
    const { user, profile } = useAuth();
    const myId = collab?.userId;
    const peers = usePresenceStore((s) => s.peers);
    const { hoverByEl } = useTaskModalPeerPresence(card.id);
    const [titleFocused, setTitleFocused] = useState(false);
    const [descFocused, setDescFocused] = useState(false);
    const [commentFocused, setCommentFocused] = useState(false);
    const remoteSync = useRef(createRemoteSyncLock()).current;

    const liveCard = (() => {
        const board = state.boards.find(b => b.id === boardId);
        if (!board) return card;
        const list = board.lists.find(l => l.id === listId);
        if (!list) return card;
        return list.cards.find(c => c.id === card.id) || card;
    })();

    // O modal é montado com key={card.id}: trocar de card remonta, então os valores iniciais bastam.
    const lastPersistedRef = useRef(snapshotFromCard(liveCard));
    const lastSyncedCardAtRef = useRef(liveCard.updatedAt ?? null);

    const [title, setTitle] = useState(liveCard.title);
    const [description, setDescription] = useState(liveCard.description || '');
    const [priority, setPriority] = useState(liveCard.priority || 'none');
    const [startDate, setStartDate] = useState(liveCard.startDate || null);
    const [dueDate, setDueDate] = useState(liveCard.dueDate || null);
    const [recurrenceRule, setRecurrenceRule] = useState(liveCard.recurrenceRule || 'none');
    const [showRecurrenceMenu, setShowRecurrenceMenu] = useState(false);
    const [isAllDay, setIsAllDay] = useState(liveCard.isAllDay ?? true);
    const [myDay, setMyDay] = useState(liveCard.myDay);
    const [dayCategory, setDayCategory] = useState(liveCard.dayCategory || 'essential');
    const [estimatedMinutes, setEstimatedMinutes] = useState(liveCard.estimatedMinutes ?? '');
    const [labels, setLabels] = useState(liveCard.labels || []);
    const [cardColor, setCardColor] = useState(liveCard.color || null);
    const [showAddLabel, setShowAddLabel] = useState(false);
    const [newLabelName, setNewLabelName] = useState('');
    const [newLabelColor, setNewLabelColor] = useState('#2ec4b6');
    const [commentBody, setCommentBody] = useState('');

    const fileInputRef = useRef(null);
    const recurrenceMenuRef = useRef(null);
    const coverPanelRef = useRef(null);
    const labelPopoverRef = useRef(null);

    const domains = useTaskCardDomains({ card, liveCard, boardId, listId, user, collabDispatch, showConfirm, commentBody, setCommentBody });
    const {
        coverAttachment,
        showLinkForm,
        setShowLinkForm,
        uploading,
        setShowCoverPanel,
        handleUploadFiles,
    } = domains;
    const recurrenceLabel = RECURRENCE_OPTIONS.find((item) => item.value === recurrenceRule)?.label || 'Não repetir';


    const liveDraftPayload = useMemo(
        () => buildTaskModalLiveDraft({ title, description, commentBody }),
        [title, description, commentBody],
    );

    const cardUpdatesSnapshot = useMemo(() => ({
        title,
        description,
        priority,
        startDate: startDate || null,
        dueDate: dueDate || null,
        recurrenceRule: recurrenceRule === 'none' ? null : recurrenceRule,
        isAllDay,
        myDay,
        dayCategory: myDay ? (dayCategory || 'essential') : null,
        estimatedMinutes: myDay && estimatedMinutes !== '' && estimatedMinutes != null
            ? Number(estimatedMinutes)
            : null,
        labels,
        color: cardColor || null,
    }), [
        title,
        description,
        priority,
        startDate,
        dueDate,
        recurrenceRule,
        isAllDay,
        myDay,
        dayCategory,
        estimatedMinutes,
        labels,
        cardColor,
    ]);

    const persistCardSnapshot = useCallback((fieldOverride = null) => {
        if (remoteSync.isLocked()) return;
        const nextSnap = fieldOverride
            ? mergeCardPersistBase(cardUpdatesSnapshot, fieldOverride)
            : cardUpdatesSnapshot;
        const delta = buildCardPersistDelta(lastPersistedRef.current, nextSnap);
        if (!Object.keys(delta).length) return;

        collabDispatch({
            type: 'UPDATE_CARD',
            payload: {
                boardId,
                listId,
                cardId: card.id,
                updates: {
                    ...delta,
                    updatedAt: new Date().toISOString(),
                },
            },
        });
        lastPersistedRef.current = mergeCardPersistBase(lastPersistedRef.current, delta);
    }, [collabDispatch, boardId, listId, card.id, cardUpdatesSnapshot, remoteSync]);

    const persistTimerRef = useRef(null);

    const flushPersist = useCallback((override = null) => {
        if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
        persistCardSnapshot(override);
    }, [persistCardSnapshot]);

    const applyDiscreteField = useCallback((fieldPatch, afterState) => {
        flushPersist();
        if (afterState) afterState();
        persistCardSnapshot(fieldPatch);
    }, [flushPersist, persistCardSnapshot]);

    useEffect(() => {
        if (!collab?.connected) return undefined;
        const timeout = setTimeout(() => {
            setLiveDraft(liveDraftPayload);
        }, 40);
        return () => clearTimeout(timeout);
    }, [liveDraftPayload, collab?.connected, setLiveDraft]);

    useEffect(() => {
        if (remoteSync.isLocked()) return undefined;
        const id = setTimeout(() => persistCardSnapshot(), 480);
        return () => clearTimeout(id);
    }, [title, description, persistCardSnapshot, remoteSync]);

    useEffect(() => () => {
        if (persistTimerRef.current) {
            clearTimeout(persistTimerRef.current);
            persistTimerRef.current = null;
        }
        persistCardSnapshot();
    }, [persistCardSnapshot]);

    const handleClose = useCallback(() => {
        flushPersist();
        onClose();
    }, [flushPersist, onClose]);

    useEffect(() => {
        remoteSync.run(() => {
            for (const peer of peers || []) {
                if (!peer?.userId || peer.userId === myId || peer.selectedCardId !== card.id || !peer.liveDraft) {
                    continue;
                }
                applyPeerTaskModalDraft(peer.liveDraft, {
                    title: titleFocused,
                    description: descFocused,
                    comment: commentFocused,
                }, {
                    setTitle,
                    setDescription,
                    setCommentBody,
                });
            }
        });
    }, [peers, card.id, myId, titleFocused, descFocused, commentFocused, remoteSync]);

    useEffect(() => {
        const stamp = liveCard.updatedAt;
        if (!stamp || stamp === lastSyncedCardAtRef.current) return;
        lastSyncedCardAtRef.current = stamp;

        remoteSync.run(() => {
            if (!titleFocused) setTitle(liveCard.title);
            if (!descFocused) setDescription(liveCard.description || '');
            setPriority(liveCard.priority || 'none');
            setStartDate(liveCard.startDate || null);
            setDueDate(liveCard.dueDate || null);
            setRecurrenceRule(liveCard.recurrenceRule || 'none');
            setIsAllDay(liveCard.isAllDay ?? true);
            setMyDay(liveCard.myDay);
            setDayCategory(liveCard.dayCategory || 'essential');
            setEstimatedMinutes(liveCard.estimatedMinutes ?? '');
            setLabels(liveCard.labels || []);
            setCardColor(liveCard.color ?? null);
            lastPersistedRef.current = snapshotFromCard(liveCard);
        });
    }, [liveCard, titleFocused, descFocused, remoteSync]);

    useEffect(() => {
        if (!boardId || !card?.id) return undefined;
        applyTaskModalPresence(boardId);
        setSelectedCardId(card.id);
        announcePresence(boardId);
        if (collab?.socket?.connected) {
            publishBoardPresenceFull(collab.socket, boardId, { user, profile });
        }
        return () => {
            restoreBoardPresenceAfterModal(boardId);
            setSelectedCardId(null);
            setHoverModalEl(null);
            setLiveDraft(null);
            announcePresence(boardId);
            if (collab?.socket?.connected) {
                const auth = { user, profile };
                publishBoardPresenceFull(collab.socket, boardId, auth);
                scheduleBoardCursorResyncAfterModal(boardId, () => {
                    if (!collab?.socket?.connected) return;
                    publishBoardPresenceFull(collab.socket, boardId, auth);
                    announcePresence(boardId);
                });
            }
        };
    }, [boardId, card?.id, setSelectedCardId, setHoverModalEl, setLiveDraft, collab?.socket, collab?.connected, user, profile]);

    const resolveModalHoverEl = useCallback((clientX, clientY) => {
        const root = modalRef.current;
        if (!root) return null;
        const stack = document.elementsFromPoint(clientX, clientY);
        for (const node of stack) {
            const hit = node.closest?.('[data-presence-hover]');
            if (hit && root.contains(hit)) {
                return hit.dataset.presenceHover || null;
            }
        }
        return null;
    }, []);

    const getModalPointerCoords = useCallback(
        (e) => pointerCoordsFromTaskModalEvent(e, modalRef.current),
        [],
    );

    const handleModalPointerMove = useCallback((e) => {
        setHoverModalEl(resolveModalHoverEl(e.clientX, e.clientY));
    }, [resolveModalHoverEl, setHoverModalEl]);

    useDocumentPointerPresence({
        enabled: Boolean(boardId && card?.id && collab?.connected),
        updateCursor,
        selectedCardId: card?.id,
        getCoords: getModalPointerCoords,
        onPointerMove: handleModalPointerMove,
    });

    const handleModalPointerLeave = () => {
        setHoverModalEl(null);
    };

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
    }, [setShowCoverPanel]);

    const handleDelete = useCallback(async ({ defaultPermanentChecked = false } = {}) => {
        const result = await showConfirm({
            title: 'Deletar Tarefa',
            message: `Tem certeza que deseja deletar "${card.title}"?`,
            confirmLabel: 'Deletar',
            type: 'danger',
            checkbox: {
                ...DELETE_TASK_CONFIRM_CHECKBOX,
                defaultChecked: defaultPermanentChecked,
            },
        });

        if (!result) return;
        const permanent = isDeleteConfirmPermanent(result);
        collabDispatch(
            { type: 'DELETE_CARD', payload: { boardId, listId, cardId: card.id } },
            permanent ? { skipHistory: true } : undefined,
        );
        onClose();
    }, [showConfirm, card.title, boardId, listId, card.id, collabDispatch, onClose]);

    const toggleLabel = (labelId) => {
        if (!labels.includes(labelId) && labels.length >= COUNT.labelsPerCard) {
            addToast(LIMIT_MSG.labelsCard, 'error');
            return;
        }
        const newLabels = labels.includes(labelId)
            ? labels.filter((l) => l !== labelId)
            : [...labels, labelId];
        applyDiscreteField({ labels: newLabels }, () => setLabels(newLabels));
    };

    const handleAddLabel = (e) => {
        e.preventDefault();
        if (!newLabelName.trim()) return;
        if (state.labels.length >= COUNT.labelsPerBoard) {
            addToast(LIMIT_MSG.labelsBoard, 'error');
            return;
        }
        if (labels.length >= COUNT.labelsPerCard) {
            addToast(LIMIT_MSG.labelsCard, 'error');
            return;
        }
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



    useEffect(() => {
        const onKey = async (e) => {
            const mod = e.ctrlKey || e.metaKey;
            const key = e.key?.toLowerCase?.() || e.key;

            if (mod && key === 'z') {
                e.preventDefault();
                e.stopPropagation();
                if (e.shiftKey) await boardRedo();
                else await boardUndo();
                return;
            }
            if (mod && key === 'y') {
                e.preventDefault();
                e.stopPropagation();
                await boardRedo();
                return;
            }
            if ((e.key === 'Delete' || e.key === 'Backspace') && e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                handleDelete({ defaultPermanentChecked: true });
                return;
            }
            if (e.key === 'Escape') handleClose();
        };
        document.addEventListener('keydown', onKey, true);
        return () => document.removeEventListener('keydown', onKey, true);
    }, [handleClose, boardUndo, boardRedo, handleDelete]);

    return createPortal(
        <>
            <div className="modal-backdrop" onClick={handleClose} />
            <div
                ref={modalRef}
                className="task-detail-modal animate-scale-in-centered"
                onPointerLeave={handleModalPointerLeave}
            >
                {collab?.connected && (
                    <CollabPresenceLayer
                        mode="screen"
                        elevated
                        modalRootRef={modalRef}
                        peerFilter={(p) => isPeerInTaskModal(p, card.id)}
                    />
                )}
                {coverAttachment?.publicUrl && (
                    <div className="task-detail-cover">
                        <img src={coverAttachment.publicUrl} alt={coverAttachment.fileName || liveCard.title} />
                    </div>
                )}

                <div className="task-detail-header">
                    <h2>Detalhes da Tarefa</h2>
                    <button type="button" {...ph(hoverByEl, 'close', 'btn-icon')} onClick={handleClose} title="Fechar">
                        <X size={20} />
                    </button>
                </div>

                <div className="task-detail-layout">
                    <div className="task-detail-body">
                        <input
                            type="text"
                            {...ph(hoverByEl, 'title', 'task-detail-title')}
                            value={title}
                            maxLength={TEXT.cardTitle}
                            onChange={e => setTitle(e.target.value)}
                            onFocus={() => setTitleFocused(true)}
                            onBlur={() => {
                                setTitleFocused(false);
                                flushPersist();
                            }}
                            placeholder="Título da tarefa..."
                        />

                        <textarea
                            {...ph(hoverByEl, 'description', 'task-detail-desc')}
                            value={description}
                            maxLength={TEXT.cardDescription}
                            onChange={e => setDescription(e.target.value)}
                            onFocus={() => setDescFocused(true)}
                            onBlur={() => {
                                setDescFocused(false);
                                flushPersist();
                            }}
                            placeholder="Adicionar descrição..."
                            rows={4}
                        />

                        <div className="task-detail-quick-actions">
                            <button
                                type="button"
                                {...ph(hoverByEl, 'quick-meu-dia', `task-detail-quick-btn ${myDay ? 'active' : ''}`)}
                                onClick={() => {
                                    const next = !myDay;
                                    applyDiscreteField(
                                        {
                                            myDay: next,
                                            dayCategory: next ? (dayCategory || 'essential') : null,
                                            estimatedMinutes: next && estimatedMinutes !== ''
                                                ? Number(estimatedMinutes)
                                                : null,
                                        },
                                        () => setMyDay(next),
                                    );
                                }}
                            >
                                <Sun size={16} />
                                <span>{myDay ? 'Meu Dia ✓' : 'Meu Dia'}</span>
                            </button>
                            {myDay && (
                                <div className="task-detail-mission-meta">
                                    <label className="task-detail-mission-label">Categoria do dia</label>
                                    <div className="task-detail-mission-cats">
                                        {[
                                            { id: 'essential', label: '⚡ Obrigatório' },
                                            { id: 'creative', label: '🎨 Criativo' },
                                            { id: 'self', label: '💛 Você' },
                                        ].map(cat => (
                                            <button
                                                key={cat.id}
                                                type="button"
                                                className={`task-detail-mission-cat ${dayCategory === cat.id ? 'active' : ''}`}
                                                onClick={() => applyDiscreteField(
                                                    { dayCategory: cat.id },
                                                    () => setDayCategory(cat.id),
                                                )}
                                            >
                                                {cat.label}
                                            </button>
                                        ))}
                                    </div>
                                    <label className="task-detail-mission-label" htmlFor="task-estimated-min">Tempo estimado (min)</label>
                                    <input
                                        id="task-estimated-min"
                                        type="number"
                                        min="0"
                                        className="task-detail-mission-time-input"
                                        value={estimatedMinutes}
                                        onBlur={() => {
                                            const mins = estimatedMinutes !== '' && estimatedMinutes != null
                                                ? Number(estimatedMinutes)
                                                : null;
                                            persistCardSnapshot({
                                                estimatedMinutes: Number.isFinite(mins) ? mins : null,
                                            });
                                        }}
                                        onChange={(e) => setEstimatedMinutes(e.target.value)}
                                        placeholder="ex: 35"
                                    />
                                </div>
                            )}
                            <button
                                type="button"
                                {...ph(hoverByEl, 'quick-arquivo', 'task-detail-quick-btn')}
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                            >
                                <Upload size={16} />
                                <span>{uploading ? 'Enviando...' : 'Adicionar arquivo'}</span>
                            </button>
                            <button
                                type="button"
                                {...ph(hoverByEl, 'quick-link', `task-detail-quick-btn ${showLinkForm ? 'active' : ''}`)}
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
                                            {...ph(
                                                hoverByEl,
                                                `color-${key}`,
                                                `task-detail-color-chip ${isActive ? 'active' : ''} ${!c ? 'none' : ''} ${isGlass ? 'glass' : ''}`,
                                                !isGlass && c ? { background: c } : {},
                                            )}
                                            title={isGlass ? 'Vidro (usa a cor da lista)' : (c ?? 'Sem cor')}
                                            onClick={() => applyDiscreteField(
                                                { color: c || null },
                                                () => setCardColor(c),
                                            )}
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
                                onChange={(v) => applyDiscreteField({ startDate: v || null }, () => setStartDate(v))}
                                isAllDay={isAllDay}
                                onToggleAllDay={() => applyDiscreteField(
                                    { isAllDay: !isAllDay },
                                    () => setIsAllDay((prev) => !prev),
                                )}
                                hoverByEl={hoverByEl}
                                presenceKey="inicio"
                            />

                            <TaskDateTimeField
                                label="Fim"
                                value={dueDate}
                                onChange={(v) => applyDiscreteField({ dueDate: v || null }, () => setDueDate(v))}
                                isAllDay={isAllDay}
                                onToggleAllDay={() => applyDiscreteField(
                                    { isAllDay: !isAllDay },
                                    () => setIsAllDay((prev) => !prev),
                                )}
                                hoverByEl={hoverByEl}
                                presenceKey="fim"
                            />

                            <div className="task-detail-field task-detail-field-full">
                                <label><Repeat size={15} /> Repetir</label>
                                <div className="task-detail-menu-wrap" ref={recurrenceMenuRef}>
                                    <button
                                        type="button"
                                        {...ph(hoverByEl, 'recurrence-trigger', 'task-detail-menu-trigger')}
                                        onClick={() => setShowRecurrenceMenu((prev) => !prev)}
                                    >
                                        <span>{recurrenceLabel}</span>
                                        <ChevronDown size={14} />
                                    </button>
                                    {showRecurrenceMenu && (
                                        <div className="task-detail-menu-dropdown">
                                            {RECURRENCE_OPTIONS.map((option) => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    {...ph(
                                                        hoverByEl,
                                                        `recurrence-${option.value}`,
                                                        `task-detail-menu-option ${recurrenceRule === option.value ? 'active' : ''}`,
                                                    )}
                                                    onClick={() => {
                                                        const val = option.value;
                                                        applyDiscreteField(
                                                            { recurrenceRule: val === 'none' ? null : val },
                                                            () => setRecurrenceRule(val),
                                                        );
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
                                    {PRIORITY_OPTIONS.map(p => (
                                        <button
                                            key={p.value}
                                            type="button"
                                            {...ph(
                                                hoverByEl,
                                                `priority-${p.value}`,
                                                `task-detail-priority-btn ${priority === p.value ? 'active' : ''}`,
                                                { '--priority-color': p.color },
                                            )}
                                            onClick={() => applyDiscreteField(
                                                { priority: p.value },
                                                () => setPriority(p.value),
                                            )}
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
                                        type="button"
                                        {...ph(
                                            hoverByEl,
                                            `label-${l.id}`,
                                            `task-detail-label-btn ${labels.includes(l.id) ? 'selected' : ''}`,
                                            { '--label-color': l.color },
                                        )}
                                        onClick={() => toggleLabel(l.id)}
                                        title={l.name}
                                    >
                                        <span className="task-detail-label-dot" />
                                        {l.name}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    {...ph(hoverByEl, 'label-add', 'task-detail-label-btn add-btn')}
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
                                        maxLength={TEXT.labelName}
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

                        <TaskAttachmentsSection domains={domains} fileInputRef={fileInputRef} />

                        <TaskSubtasksSection
                            subtasks={liveCard.subtasks || []}
                            boardId={boardId}
                            listId={listId}
                            cardId={card.id}
                            collabDispatch={collabDispatch}
                            hoverByEl={hoverByEl}
                        />
                    </div>

                    <TaskDetailSidebar
                        domains={domains}
                        hoverByEl={hoverByEl}
                        liveCard={liveCard}
                        user={user}
                        coverPanelRef={coverPanelRef}
                        commentBody={commentBody}
                        setCommentBody={setCommentBody}
                        setCommentFocused={setCommentFocused}
                    />
                </div>

                <div className="task-detail-footer">
                    <div className="task-detail-footer-actions">
                        <button
                            type="button"
                            {...ph(hoverByEl, 'delete', 'btn btn-danger btn-sm')}
                            onClick={() => handleDelete({ defaultPermanentChecked: false })}
                        >
                            <Trash2 size={14} /> Deletar
                        </button>
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm task-detail-delete-permanent"
                            onClick={() => handleDelete({ defaultPermanentChecked: true })}
                            title="Eliminar para sempre (Shift+Delete)"
                        >
                            <Ban size={14} /> Eliminar para sempre
                        </button>
                    </div>
                    <div className="task-detail-footer-info">
                        Ctrl+Z desfaz por ação · Shift+Delete elimina sem restaurar
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
}
