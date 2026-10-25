import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/useApp';
import { useAuth } from '../../context/useAuth';
import { useBoardCollabDispatch } from '../../collab/board/ops/useBoardCollab';
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
import { useCollab } from '../../collab/core/useCollab';
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
    ChevronRight,
    Ban,
    MoreHorizontal,
    CalendarDays,
    Palette,
} from 'lucide-react';
import './TaskDetail.css';
import { uuidv4 } from '../../utils/uuid';
import { TEXT, COUNT } from '@dailyways/limits';
import { LIMIT_MSG } from '../../limits/messages.js';
import { useToast } from '../../context/useToast';
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
    const [remoteSync] = useState(createRemoteSyncLock);

    const liveBoard = state.boards.find(b => b.id === boardId) || null;
    // procura o card em todas as listas: se alguém o moveu, o modal continua acompanhando
    const liveList = liveBoard?.lists.find(l => l.cards.some(c => c.id === card.id))
        || liveBoard?.lists.find(l => l.id === listId)
        || null;
    const liveCard = liveList?.cards.find(c => c.id === card.id) || card;
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef(null);
    const titleRef = useRef(null);

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
            const typing = e.target?.closest?.('input, textarea, select, [contenteditable="true"]');
            if (e.key === 'Escape') {
                if (showMenu) { setShowMenu(false); return; }
                handleClose();
                return;
            }
            // digitando: Ctrl+Z desfaz o texto e Shift+Backspace apaga letra (não o card)
            if (typing) return;

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
            }
        };
        document.addEventListener('keydown', onKey, true);
        return () => document.removeEventListener('keydown', onKey, true);
    }, [handleClose, boardUndo, boardRedo, handleDelete, showMenu]);

    // título cresce em linhas em vez de cortar
    useEffect(() => {
        const el = titleRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    }, [title]);

    useEffect(() => {
        if (!showMenu) return undefined;
        const onDown = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [showMenu]);

    const toggleMyDay = () => {
        const next = !myDay;
        applyDiscreteField(
            {
                myDay: next,
                dayCategory: next ? (dayCategory || 'essential') : null,
                estimatedMinutes: next && estimatedMinutes !== '' ? Number(estimatedMinutes) : null,
            },
            () => setMyDay(next),
        );
    };

    return createPortal(
        <>
            <div className="modal-backdrop" onClick={handleClose} />
            <div
                ref={modalRef}
                className="task-detail-modal animate-scale-in-centered"
                role="dialog"
                aria-modal="true"
                aria-label={title || 'Tarefa'}
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

                <div className="td-head">
                    <span className="td-crumb" title={`${liveBoard?.title ?? ''} › ${liveList?.title ?? ''}`}>
                        {liveBoard && <span className="td-crumb-board">{liveBoard.emoji} {liveBoard.title}</span>}
                        {liveList && (
                            <>
                                <ChevronRight size={14} aria-hidden />
                                <span className="td-crumb-list">{liveList.title}</span>
                            </>
                        )}
                    </span>
                    <div className="td-head-actions">
                        <button
                            type="button"
                            {...ph(hoverByEl, 'quick-meu-dia', `td-chip-btn ${myDay ? 'is-on' : ''}`)}
                            aria-pressed={Boolean(myDay)}
                            onClick={toggleMyDay}
                            title={myDay ? 'Tirar do Diário' : 'Adicionar ao Diário'}
                        >
                            <Sun size={15} aria-hidden />
                            <span>{myDay ? 'No Diário' : 'Diário'}</span>
                        </button>
                        <div className="td-menu-wrap" ref={menuRef}>
                            <button
                                type="button"
                                className="td-icon-btn"
                                aria-haspopup="menu"
                                aria-expanded={showMenu}
                                aria-label="Mais ações"
                                onClick={() => setShowMenu((v) => !v)}
                            >
                                <MoreHorizontal size={18} />
                            </button>
                            {showMenu && (
                                <div className="td-menu" role="menu">
                                    <button type="button" role="menuitem" onClick={() => { setShowMenu(false); fileInputRef.current?.click(); }} disabled={uploading}>
                                        <Upload size={15} /> {uploading ? 'Enviando…' : 'Anexar arquivo'}
                                    </button>
                                    <button type="button" role="menuitem" onClick={() => { setShowMenu(false); setShowLinkForm(true); }}>
                                        <LinkIcon size={15} /> Anexar link
                                    </button>
                                    <div className="td-menu-sep" />
                                    <button type="button" role="menuitem" className="is-danger" onClick={() => { setShowMenu(false); handleDelete({ defaultPermanentChecked: false }); }}>
                                        <Trash2 size={15} /> Excluir
                                    </button>
                                    <button type="button" role="menuitem" className="is-danger" title="Shift+Delete" onClick={() => { setShowMenu(false); handleDelete({ defaultPermanentChecked: true }); }}>
                                        <Ban size={15} /> Excluir para sempre
                                    </button>
                                </div>
                            )}
                        </div>
                        <button type="button" {...ph(hoverByEl, 'close', 'td-icon-btn')} onClick={handleClose} aria-label="Fechar" title="Fechar (Esc)">
                            <X size={18} />
                        </button>
                    </div>
                    <input ref={fileInputRef} type="file" multiple hidden onChange={handleUploadFiles} />
                </div>

                <div className="task-detail-layout">
                    <div className="task-detail-body">
                        {coverAttachment?.publicUrl && (
                            <div className="task-detail-cover">
                                <img src={coverAttachment.publicUrl} alt="" />
                            </div>
                        )}
                        <textarea
                            ref={titleRef}
                            rows={1}
                            {...ph(hoverByEl, 'title', 'task-detail-title')}
                            value={title}
                            maxLength={TEXT.cardTitle}
                            onChange={e => setTitle(e.target.value.replace(/\n/g, ' '))}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    e.currentTarget.blur();
                                }
                            }}
                            onFocus={() => setTitleFocused(true)}
                            onBlur={() => {
                                setTitleFocused(false);
                                flushPersist();
                            }}
                            placeholder="Título da tarefa"
                            aria-label="Título"
                        />

                        <div className="td-props">
                            <div className="td-prop">
                                <span className="td-prop-label"><AlertCircle size={15} aria-hidden /> Prioridade</span>
                                <div className="td-prop-value">
                                    <div className="task-detail-priority-grid" role="radiogroup" aria-label="Prioridade">
                                        {PRIORITY_OPTIONS.map(p => (
                                            <button
                                                key={p.value}
                                                type="button"
                                                role="radio"
                                                aria-checked={priority === p.value}
                                                {...ph(
                                                    hoverByEl,
                                                    `priority-${p.value}`,
                                                    `task-detail-priority-btn ${priority === p.value ? 'active' : ''}`,
                                                    { '--priority-color': p.color },
                                                )}
                                                onClick={() => applyDiscreteField({ priority: p.value }, () => setPriority(p.value))}
                                            >
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="td-prop td-prop--dates">
                                <span className="td-prop-label"><CalendarDays size={15} aria-hidden /> Datas</span>
                                <div className="td-prop-value td-dates">
                                    <TaskDateTimeField
                                        label="Início"
                                        value={startDate}
                                        onChange={(v) => applyDiscreteField({ startDate: v || null }, () => setStartDate(v))}
                                        isAllDay={isAllDay}
                                        onToggleAllDay={() => applyDiscreteField({ isAllDay: !isAllDay }, () => setIsAllDay((prev) => !prev))}
                                        hoverByEl={hoverByEl}
                                        presenceKey="inicio"
                                    />
                                    <TaskDateTimeField
                                        label="Fim"
                                        value={dueDate}
                                        onChange={(v) => applyDiscreteField({ dueDate: v || null }, () => setDueDate(v))}
                                        isAllDay={isAllDay}
                                        onToggleAllDay={() => applyDiscreteField({ isAllDay: !isAllDay }, () => setIsAllDay((prev) => !prev))}
                                        hoverByEl={hoverByEl}
                                        presenceKey="fim"
                                    />
                                </div>
                            </div>

                            <div className="td-prop">
                                <span className="td-prop-label"><Repeat size={15} aria-hidden /> Repetir</span>
                                <div className="td-prop-value task-detail-menu-wrap" ref={recurrenceMenuRef}>
                                    <button
                                        type="button"
                                        {...ph(hoverByEl, 'recurrence-trigger', 'task-detail-menu-trigger')}
                                        onClick={() => setShowRecurrenceMenu((prev) => !prev)}
                                        aria-haspopup="listbox"
                                        aria-expanded={showRecurrenceMenu}
                                    >
                                        <span>{recurrenceLabel}</span>
                                        <ChevronDown size={14} />
                                    </button>
                                    {showRecurrenceMenu && (
                                        <div className="task-detail-menu-dropdown" role="listbox">
                                            {RECURRENCE_OPTIONS.map((option) => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    role="option"
                                                    aria-selected={recurrenceRule === option.value}
                                                    {...ph(
                                                        hoverByEl,
                                                        `recurrence-${option.value}`,
                                                        `task-detail-menu-option ${recurrenceRule === option.value ? 'active' : ''}`,
                                                    )}
                                                    onClick={() => {
                                                        const val = option.value;
                                                        applyDiscreteField({ recurrenceRule: val === 'none' ? null : val }, () => setRecurrenceRule(val));
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

                            <div className="td-prop">
                                <span className="td-prop-label"><Tag size={15} aria-hidden /> Etiquetas</span>
                                <div className="td-prop-value">
                                    <div className="task-detail-labels">
                                        {LABEL_COLORS.map(l => (
                                            <button
                                                key={l.id}
                                                type="button"
                                                aria-pressed={labels.includes(l.id)}
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
                                            aria-label="Criar etiqueta"
                                            title="Criar etiqueta"
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
                                                        type="button"
                                                        aria-label={`Cor ${c}`}
                                                        className={`color-dot ${newLabelColor === c ? 'selected' : ''}`}
                                                        style={{ background: c }}
                                                        onClick={() => setNewLabelColor(c)}
                                                    />
                                                ))}
                                                <button
                                                    type="button"
                                                    aria-label="Outra cor"
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
                                            <button type="button" className="btn btn-primary btn-sm btn-full" onClick={handleAddLabel}>
                                                Criar etiqueta
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="td-prop">
                                <span className="td-prop-label"><Palette size={15} aria-hidden /> Cor</span>
                                <div className="td-prop-value task-detail-color-row">
                                    {[null, '#6b7280', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '__glass__'].map((c) => {
                                        const isGlass = c === '__glass__';
                                        const key = c ?? (isGlass ? 'glass' : 'none');
                                        const isActive = cardColor === c;
                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                aria-pressed={isActive}
                                                aria-label={isGlass ? 'Vidro (cor da lista)' : (c ?? 'Sem cor')}
                                                {...ph(
                                                    hoverByEl,
                                                    `color-${key}`,
                                                    `task-detail-color-chip ${isActive ? 'active' : ''} ${!c ? 'none' : ''} ${isGlass ? 'glass' : ''}`,
                                                    !isGlass && c ? { background: c } : {},
                                                )}
                                                title={isGlass ? 'Vidro (usa a cor da lista)' : (c ?? 'Sem cor')}
                                                onClick={() => applyDiscreteField({ color: c || null }, () => setCardColor(c))}
                                            >
                                                {isGlass && <span className="task-detail-color-glass-dot" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {myDay && (
                                <div className="td-prop">
                                    <span className="td-prop-label"><Sun size={15} aria-hidden /> No Diário</span>
                                    <div className="td-prop-value td-myday">
                                        <div className="task-detail-mission-cats">
                                            {[
                                                { id: 'essential', label: '⚡ Obrigatório' },
                                                { id: 'creative', label: '🎨 Criativo' },
                                                { id: 'self', label: '💛 Você' },
                                            ].map(cat => (
                                                <button
                                                    key={cat.id}
                                                    type="button"
                                                    aria-pressed={dayCategory === cat.id}
                                                    className={`task-detail-mission-cat ${dayCategory === cat.id ? 'active' : ''}`}
                                                    onClick={() => applyDiscreteField({ dayCategory: cat.id }, () => setDayCategory(cat.id))}
                                                >
                                                    {cat.label}
                                                </button>
                                            ))}
                                        </div>
                                        <label className="td-minutes">
                                            <input
                                                type="number"
                                                min="0"
                                                className="task-detail-mission-time-input"
                                                value={estimatedMinutes}
                                                onBlur={() => {
                                                    const mins = estimatedMinutes !== '' && estimatedMinutes != null ? Number(estimatedMinutes) : null;
                                                    persistCardSnapshot({ estimatedMinutes: Number.isFinite(mins) ? mins : null });
                                                }}
                                                onChange={(e) => setEstimatedMinutes(e.target.value)}
                                                placeholder="35"
                                                aria-label="Tempo estimado em minutos"
                                            />
                                            <span>min</span>
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>

                        <section className="td-section">
                            <h3 className="td-section-title">Descrição</h3>
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
                                placeholder="Detalhes, contexto, links…"
                                rows={4}
                                aria-label="Descrição"
                            />
                        </section>

                        <TaskSubtasksSection
                            subtasks={liveCard.subtasks || []}
                            boardId={boardId}
                            listId={liveList?.id ?? listId}
                            cardId={card.id}
                            collabDispatch={collabDispatch}
                            hoverByEl={hoverByEl}
                        />

                        <TaskAttachmentsSection domains={domains} fileInputRef={fileInputRef} />
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
            </div>
        </>,
        document.body
    );
}
