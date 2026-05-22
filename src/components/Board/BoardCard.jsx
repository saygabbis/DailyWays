import { useState, useEffect } from 'react';
import { useRemoteCardAnim } from '../../hooks/useBoardRemoteAnim';
import { useApp } from '../../context/AppContext';
import { useBoardCollabDispatch } from '../../collab/board/ops/BoardCollabContext.jsx';
import { useContextMenu, useLongPress } from '../Common/ContextMenu';
import { useCoarsePointer } from '../../hooks/useCoarsePointer';
import { Calendar, CheckSquare, AlertCircle, Sun, Edit3, Trash2, Star, Tag, Copy, ArrowRight, Circle, CheckCircle2, MoreHorizontal, FileText } from 'lucide-react';
import { formatCardDateTime, isCardDueToday, isCardOverdue } from '../../utils/cardDateTime';
import { uuidv4 } from '../../utils/uuid';
import { useCardCoverImage } from '../../hooks/useCardCoverImage';

export default function BoardCard({
    card,
    boardId,
    listId,
    listColor,
    isDragging,
    isRemoteDragging,
    remoteDragPeer = null,
    onClick,
    editingEditors = [],
    hoverPeers = [],
    onHoverStart,
    onHoverEnd,
}) {
    const { LABEL_COLORS, showConfirm } = useApp();
    const { collabDispatch } = useBoardCollabDispatch(boardId);
    const { showContextMenu } = useContextMenu();
    const isCompleted = card.completed || false;

    const handleToggleComplete = (e) => {
        e.stopPropagation();
        collabDispatch({
            type: 'UPDATE_CARD',
            payload: { boardId, listId, cardId: card.id, updates: { completed: !isCompleted } },
        });
    };

    const doneSubtasks = card.subtasks.filter(st => st.done).length;
    const totalSubtasks = card.subtasks.length;
    const hasSubtasks = totalSubtasks > 0;
    const allDone = hasSubtasks && doneSubtasks === totalSubtasks;

    const priorityConfig = {
        urgent: { color: '#f85149', label: 'Urgente' },
        high: { color: '#ffa06b', label: 'Alta' },
        medium: { color: '#d29922', label: 'Média' },
        low: { color: '#8b949e', label: 'Baixa' },
    };

    const isOverdue = isCardOverdue(card);
    const isDueToday = isCardDueToday(card);
    const hasDescription = Boolean(card.description && card.description.trim().length > 0);
    const effectiveColor = card.color === '__glass__' ? (listColor || null) : card.color || null;
    const primaryEditor = editingEditors?.[0] || null;
    const hoverPeer = hoverPeers?.[0] || null;
    const presenceColor = primaryEditor?.color
        || remoteDragPeer?.color
        || hoverPeer?.color
        || 'var(--accent-primary)';
    const isBeingEdited = Array.isArray(editingEditors) && editingEditors.length > 0;
    const isRemoteHover = !isBeingEdited && Boolean(hoverPeer);
    const fetchedCoverUrl = useCardCoverImage(card.id, card.coverAttachmentId);
    const coverUrl = fetchedCoverUrl || card.coverPreviewUrl || null;

    const getContextMenuItems = () => [
        {
            label: 'Editar tarefa',
            icon: <Edit3 size={15} />,
            action: () => onClick(),
        },
        {
            label: card.myDay ? 'Remover do Meu Dia' : 'Adicionar ao Meu Dia',
            icon: <Sun size={15} />,
            action: () => collabDispatch({
                type: 'UPDATE_CARD',
                payload: { boardId, listId, cardId: card.id, updates: { myDay: !card.myDay } },
            }),
        },
        {
            label: card.priority === 'high' ? 'Remover importância' : 'Marcar como importante',
            icon: <Star size={15} />,
            action: () => collabDispatch({
                type: 'UPDATE_CARD',
                payload: {
                    boardId, listId, cardId: card.id,
                    updates: { priority: card.priority === 'high' ? 'none' : 'high' },
                },
            }),
        },
        { type: 'divider' },
        {
            label: 'Duplicar tarefa',
            icon: <Copy size={15} />,
            action: () => collabDispatch({
                type: 'ADD_CARD',
                payload: {
                    boardId, listId,
                    cardData: {
                        title: `${card.title} (cópia)`,
                        description: card.description,
                        labels: [...card.labels],
                        priority: card.priority,
                        dueDate: card.dueDate,
                        startDate: card.startDate,
                        isAllDay: card.isAllDay ?? true,
                        recurrenceRule: card.recurrenceRule ?? null,
                        coverAttachmentId: card.coverAttachmentId ?? null,
                        myDay: false,
                        subtasks: card.subtasks.map((st, index) => ({
                            id: uuidv4(),
                            title: st.title,
                            done: false,
                            position: st.position ?? index,
                            linkUrl: st.linkUrl ?? null,
                            linkLabel: st.linkLabel ?? null,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                        })),
                    },
                },
            }),
        },
        { type: 'divider' },
        {
            label: 'Deletar tarefa',
            icon: <Trash2 size={15} />,
            danger: true,
            action: async () => {
                const confirmed = await showConfirm({
                    title: 'Deletar Tarefa',
                    message: `Tem certeza que deseja deletar "${card.title}"?`,
                    confirmLabel: 'Deletar',
                    type: 'danger'
                });
                if (confirmed) {
                    collabDispatch({
                        type: 'DELETE_CARD',
                        payload: { boardId, listId, cardId: card.id },
                    });
                }
            },
        },
    ];

    const handleContextMenu = (e) => {
        showContextMenu(e, getContextMenuItems(), { title: card.title, tint: effectiveColor || null });
    };

    const coarsePointer = useCoarsePointer();
    const { cancel: cancelLongPress, ...cardLongPressTouch } = useLongPress(handleContextMenu, undefined, { disabled: coarsePointer });

    useEffect(() => {
        if (isDragging) cancelLongPress?.();
    }, [isDragging, cancelLongPress]);

    const remoteAnim = useRemoteCardAnim(card.id);

    // Animation auto-cleanup to prevent restart on DND portal remount
    const [shouldAnimate, setShouldAnimate] = useState(true);
    useEffect(() => {
        const timer = setTimeout(() => {
            setShouldAnimate(false);
        }, 600);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!remoteAnim) return;
        setShouldAnimate(true);
        const timer = setTimeout(() => setShouldAnimate(false), 700);
        return () => clearTimeout(timer);
    }, [remoteAnim]);

    return (
        <div
            className={`board-card ${isDragging ? 'board-card-dragging' : ''} ${isRemoteDragging ? 'board-card-remote-drag-source' : ''} ${remoteAnim ? 'board-card-remote-drop-anim' : ''} ${isCompleted ? 'board-card-done-state' : ''} ${allDone ? 'board-card-all-subtasks-done' : ''} ${isBeingEdited ? 'board-card-presence-active' : ''} ${isRemoteHover ? 'board-card-remote-hover' : ''}`}
            onClick={onClick}
            onContextMenu={handleContextMenu}
            onMouseEnter={() => onHoverStart?.()}
            onMouseLeave={() => onHoverEnd?.()}
            {...cardLongPressTouch}
            style={{
              ...(effectiveColor ? { '--card-accent': effectiveColor } : {}),
              ...((isBeingEdited || isRemoteHover || isRemoteDragging) ? { '--presence-color': presenceColor } : {}),
            }}
            data-colored={effectiveColor ? 'true' : undefined}
        >
            {card.coverAttachmentId && (
                <div
                    className={`board-card-cover board-card-cover-active${coverUrl ? ' board-card-cover-loaded' : ''}`}
                    aria-hidden="true"
                >
                    {coverUrl ? (
                        <img
                            src={coverUrl}
                            alt=""
                            className="board-card-cover-img"
                            loading="lazy"
                            decoding="async"
                        />
                    ) : null}
                </div>
            )}
            {isBeingEdited && (
                <div
                    className={`board-card-presence-indicator${primaryEditor?.isSelf ? ' board-card-presence-indicator--self' : ''}`}
                    aria-label={
                        primaryEditor?.isSelf
                            ? 'Você está nos detalhes desta tarefa'
                            : `Sendo editado por ${primaryEditor?.name || 'alguém'}`
                    }
                >
                    {primaryEditor?.photoUrl ? (
                        <img
                            src={primaryEditor.photoUrl}
                            alt={primaryEditor.name || primaryEditor.userId}
                            onLoad={(e) => {
                                const wrap = e.currentTarget.closest('.board-card-presence-indicator');
                                const fallback = wrap?.querySelector('.board-card-presence-fallback');
                                if (fallback) fallback.style.display = 'none';
                            }}
                            onError={(e) => {
                                // se falhar, mantém o fallback visível
                                void e;
                            }}
                        />
                    ) : null}
                    <span className="board-card-presence-fallback">{primaryEditor?.avatarInitial || '?'}</span>
                </div>
            )}
            <div className={`board-card-inner ${shouldAnimate ? 'animate-slide-up-jelly' : ''}`}>
                {/* Labels */}
                {card.labels.length > 0 && (
                    <div className="board-card-labels">
                        {card.labels.map(labelId => {
                            const label = LABEL_COLORS.find(l => l.id === labelId);
                            return label ? (
                                <span
                                    key={labelId}
                                    className="board-card-label"
                                    style={{ background: label.color }}
                                    title={label.name}
                                />
                            ) : null;
                        })}
                    </div>
                )}

                {/* Title and Checkbox */}
                <div className="board-card-header">
                    <button
                        className={`board-card-check ${isCompleted ? 'completed' : ''}`}
                        onClick={handleToggleComplete}
                        title={isCompleted ? 'Marcar como não concluída' : 'Marcar como concluída'}
                    >
                        {isCompleted ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                    </button>
                    <div className="board-card-title">{card.title}</div>
                    <button
                        type="button"
                        className="board-card-menu-btn"
                        title="Opções"
                        onClick={(e) => { e.stopPropagation(); handleContextMenu(e); }}
                    >
                        <MoreHorizontal size={16} className="rotate-90" />
                    </button>
                </div>

                {/* Meta */}
                <div className="board-card-meta">
                    {hasDescription && (
                        <span className="board-card-desc" title="Este card tem descrição">
                            <FileText size={12} />
                        </span>
                    )}
                    {card.priority && card.priority !== 'none' && (
                        <span className="board-card-priority" style={{ color: priorityConfig[card.priority]?.color }}>
                            <AlertCircle size={12} />
                            {priorityConfig[card.priority]?.label}
                        </span>
                    )}

                    {card.dueDate && (
                        <span className={`board-card-due ${isOverdue ? 'overdue' : ''} ${isDueToday ? 'today' : ''}`}>
                            <Calendar size={12} />
                            {formatCardDateTime(card.dueDate, card.isAllDay ?? true)}
                        </span>
                    )}

                    {card.myDay && (
                        <span className="board-card-myday">
                            <Sun size={12} />
                        </span>
                    )}

                    {hasSubtasks && (
                        <span className={`board-card-subtasks ${allDone ? 'all-done' : ''}`}>
                            <CheckSquare size={12} />
                            {doneSubtasks}/{totalSubtasks}
                        </span>
                    )}
                </div>

                {/* Progress bar for subtasks */}
                {hasSubtasks && (
                    <div className="board-card-progress">
                        <div
                            className="board-card-progress-bar"
                            style={{
                                width: `${(doneSubtasks / totalSubtasks) * 100}%`,
                                background: allDone ? 'var(--success)' : 'var(--accent-gradient)',
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
