import { useState, useEffect, useRef } from 'react';
import { useRemoteCardAnim } from '../../hooks/useBoardRemoteAnim';
import { useApp } from '../../context/AppContext';
import { useBoardCollabDispatch } from '../../collab/board/ops/BoardCollabContext.jsx';
import { useContextMenu, useLongPressSelect } from '../Common/ContextMenu';
import { useCoarsePointer } from '../../hooks/useCoarsePointer';
import { useBoardSelectionStore } from '../../stores/boardSelectionStore';
import { Calendar, CheckSquare, AlertCircle, Sun, Edit3, Trash2, Star, Copy, ArrowRight, Circle, CheckCircle2, MoreHorizontal, FileText } from 'lucide-react';
import { formatCardDateTime, isCardDueToday, isCardOverdue } from '../../utils/cardDateTime';
import { useCardCoverImage } from '../../hooks/useCardCoverImage';
import {
    buildDuplicateCardPayload,
    bulkDeleteCards,
    bulkUpdateCards,
    bulkDuplicateCards,
    bulkMoveCardsToList,
    buildMoveToListMenuItems,
    resolveSelectedCards,
} from './boardCardBulkOps';

export default function BoardCard({
    card,
    boardId,
    listId,
    listColor,
    boardLists = [],
    visibleCardIds = [],
    isDragging,
    isMultiDragLead = false,
    multiDragCount = 0,
    remoteDragPeer = null,
    onClick,
    editingEditors = [],
    hoverPeers = [],
    remoteSelectionPeers = [],
    onHoverStart,
    onHoverEnd,
}) {
    const { LABEL_COLORS, showConfirm, getActiveBoard } = useApp();
    const { collabDispatch } = useBoardCollabDispatch(boardId);
    const { showContextMenu } = useContextMenu();
    const cardRef = useRef(null);
    const isCompleted = card.completed || false;

    const selectedCardIds = useBoardSelectionStore((s) => s.selectedCardIds);
    const toggleCard = useBoardSelectionStore((s) => s.toggleCard);
    const selectRangeInList = useBoardSelectionStore((s) => s.selectRangeInList);
    const clearSelection = useBoardSelectionStore((s) => s.clearSelection);
    const longPressPendingCardId = useBoardSelectionStore((s) => s.longPressPendingCardId);
    const setLongPressPending = useBoardSelectionStore((s) => s.setLongPressPending);

    const isSelected = selectedCardIds.includes(card.id);
    const selectionCount = selectedCardIds.length;
    const isBulkContext = isSelected && selectionCount > 1;
    const isLongPressPending = longPressPendingCardId === card.id;
    const remoteSelectionPeer = remoteSelectionPeers?.[0] || null;

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
        || remoteSelectionPeer?.color
        || hoverPeer?.color
        || 'var(--accent-primary)';
    const isBeingEdited = Array.isArray(editingEditors) && editingEditors.length > 0;
    const isRemoteHover = !isBeingEdited && Boolean(hoverPeer);
    const fetchedCoverUrl = useCardCoverImage(card.id, card.coverAttachmentId);
    const coverUrl = fetchedCoverUrl || card.coverPreviewUrl || null;

    const board = getActiveBoard();
    const selectedCards = resolveSelectedCards(board, selectedCardIds);

    const getMoveToListItems = () => buildMoveToListMenuItems(boardLists, listId, (destListId) => {
        bulkMoveCardsToList([{ card, listId }], destListId, getActiveBoard, collabDispatch);
    });

    const getSingleContextMenuItems = () => [
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
            label: 'Mover para coluna',
            icon: <ArrowRight size={15} />,
            disabled: true,
        },
        ...getMoveToListItems(),
        {
            label: 'Duplicar tarefa',
            icon: <Copy size={15} />,
            action: () => collabDispatch(buildDuplicateCardPayload(card, listId, boardId)),
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
                    type: 'danger',
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

    const getBulkContextMenuItems = () => {
        const count = selectionCount;
        const allMyDay = selectedCards.every(({ card: c }) => c.myDay);
        const allImportant = selectedCards.every(({ card: c }) => c.priority === 'high');
        return [
            {
                label: 'Limpar seleção',
                icon: <Edit3 size={15} />,
                action: () => clearSelection(),
            },
            { type: 'divider' },
            {
                label: allMyDay ? 'Remover do Meu Dia' : 'Adicionar ao Meu Dia',
                icon: <Sun size={15} />,
                action: () => bulkUpdateCards(selectedCards, boardId, { myDay: !allMyDay }, collabDispatch),
            },
            {
                label: allImportant ? 'Remover importância' : 'Marcar como importante',
                icon: <Star size={15} />,
                action: () => bulkUpdateCards(
                    selectedCards,
                    boardId,
                    { priority: allImportant ? 'none' : 'high' },
                    collabDispatch,
                ),
            },
            {
                label: 'Duplicar selecionados',
                icon: <Copy size={15} />,
                action: () => bulkDuplicateCards(selectedCards, boardId, collabDispatch),
            },
            {
                label: 'Mover para coluna',
                icon: <ArrowRight size={15} />,
                disabled: true,
            },
            ...buildMoveToListMenuItems(boardLists, null, (destListId) => {
                bulkMoveCardsToList(selectedCards, destListId, getActiveBoard, collabDispatch);
                clearSelection();
            }),
            { type: 'divider' },
            {
                label: 'Deletar selecionados',
                icon: <Trash2 size={15} />,
                danger: true,
                action: async () => {
                    const ok = await bulkDeleteCards(selectedCards, boardId, collabDispatch, showConfirm);
                    if (ok) clearSelection();
                },
            },
        ].filter(Boolean);
    };

    const handleContextMenu = (e) => {
        if (isBulkContext) {
            showContextMenu(e, getBulkContextMenuItems(), { title: `${selectionCount} Selecionados` });
            return;
        }
        showContextMenu(e, getSingleContextMenuItems(), { title: card.title, tint: effectiveColor || null });
    };

    const coarsePointer = useCoarsePointer();

    const handleCardClick = (e) => {
        if (e.defaultPrevented) return;
        const mod = e.ctrlKey || e.metaKey;
        if (mod) {
            e.preventDefault();
            e.stopPropagation();
            toggleCard(card.id, listId);
            return;
        }
        if (e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            selectRangeInList(listId, visibleCardIds, card.id);
            return;
        }
        if (selectionCount > 0 && coarsePointer) {
            e.preventDefault();
            e.stopPropagation();
            toggleCard(card.id, listId);
            return;
        }
        if (selectionCount > 0) {
            clearSelection();
        }
        onClick();
    };

    const { cancel: cancelLongPressSelect, ...longPressSelectTouch } = useLongPressSelect({
        onSelect: () => toggleCard(card.id, listId),
        elementRef: cardRef,
        disabled: !coarsePointer,
        onPendingChange: (pending) => setLongPressPending(pending ? card.id : null),
    });

    useEffect(() => {
        if (isDragging) cancelLongPressSelect?.();
    }, [isDragging, cancelLongPressSelect]);

    const remoteAnim = useRemoteCardAnim(card.id);

    const [shouldAnimate, setShouldAnimate] = useState(true);
    useEffect(() => {
        const timer = setTimeout(() => setShouldAnimate(false), 600);
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
            ref={cardRef}
            data-card-id={card.id}
            className={[
                'board-card',
                isDragging ? 'board-card-dragging' : '',
                isMultiDragLead ? 'board-card-multi-drag-lead' : '',
                remoteAnim ? 'board-card-remote-drop-anim' : '',
                isCompleted ? 'board-card-done-state' : '',
                allDone ? 'board-card-all-subtasks-done' : '',
                isBeingEdited ? 'board-card-presence-active' : '',
                isRemoteHover ? 'board-card-remote-hover' : '',
                isSelected ? 'board-card--selected' : '',
                isLongPressPending ? 'board-card--long-press-pending' : '',
                remoteSelectionPeer ? 'board-card--remote-selected' : '',
            ].filter(Boolean).join(' ')}
            onClick={handleCardClick}
            onContextMenu={handleContextMenu}
            onMouseEnter={() => onHoverStart?.()}
            onMouseLeave={() => onHoverEnd?.()}
            {...longPressSelectTouch}
            style={{
              ...(effectiveColor ? { '--card-accent': effectiveColor } : {}),
              ...((isBeingEdited || isRemoteHover || remoteSelectionPeer)
                ? { '--presence-color': presenceColor }
                : {}),
            }}
            data-colored={effectiveColor ? 'true' : undefined}
        >
            {isMultiDragLead && multiDragCount > 1 && (
                <span className="board-card-multi-drag-badge" aria-hidden>
                    {multiDragCount}
                </span>
            )}
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
                            onError={() => {}}
                        />
                    ) : null}
                    <span className="board-card-presence-fallback">{primaryEditor?.avatarInitial || '?'}</span>
                </div>
            )}
            <div className={`board-card-inner ${shouldAnimate ? 'animate-slide-up-jelly' : ''}`}>
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