import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useContextMenu, useLongPress } from '../Common/ContextMenu';
import { Calendar, CheckSquare, AlertCircle, Sun, Edit3, Trash2, Star, Tag, Copy, ArrowRight, Circle, CheckCircle2 } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function BoardCard({ card, boardId, listId, isDragging, onClick }) {
    const { LABEL_COLORS, dispatch, showConfirm } = useApp();
    const { showContextMenu } = useContextMenu();
    const isCompleted = card.completed || false;

    const handleToggleComplete = (e) => {
        e.stopPropagation();
        dispatch({
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

    const isOverdue = card.dueDate && isPast(new Date(card.dueDate)) && !isToday(new Date(card.dueDate));

    const getContextMenuItems = () => [
        {
            label: 'Editar tarefa',
            icon: <Edit3 size={15} />,
            action: () => onClick(),
        },
        {
            label: card.myDay ? 'Remover do Meu Dia' : 'Adicionar ao Meu Dia',
            icon: <Sun size={15} />,
            action: () => dispatch({
                type: 'UPDATE_CARD',
                payload: { boardId, listId, cardId: card.id, updates: { myDay: !card.myDay } },
            }),
        },
        {
            label: card.priority === 'high' ? 'Remover importância' : 'Marcar como importante',
            icon: <Star size={15} />,
            action: () => dispatch({
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
            action: () => dispatch({
                type: 'ADD_CARD',
                payload: {
                    boardId, listId,
                    cardData: {
                        title: `${card.title} (cópia)`,
                        description: card.description,
                        labels: [...card.labels],
                        priority: card.priority,
                        dueDate: card.dueDate,
                        myDay: false,
                        subtasks: card.subtasks.map(st => ({
                            id: crypto.randomUUID(),
                            title: st.title,
                            done: false,
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
                    dispatch({
                        type: 'DELETE_CARD',
                        payload: { boardId, listId, cardId: card.id },
                    });
                }
            },
        },
    ];

    const handleContextMenu = (e) => {
        showContextMenu(e, getContextMenuItems(), { title: card.title });
    };

    const longPressProps = useLongPress(handleContextMenu);

    // Animation auto-cleanup to prevent restart on DND portal remount
    const [shouldAnimate, setShouldAnimate] = useState(true);
    useEffect(() => {
        const timer = setTimeout(() => {
            setShouldAnimate(false);
        }, 600);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div
            className={`board-card ${isDragging ? 'board-card-dragging' : ''} ${isCompleted ? 'board-card-done-state' : ''} ${allDone ? 'board-card-all-subtasks-done' : ''}`}
            onClick={onClick}
            onContextMenu={handleContextMenu}
            {...longPressProps}
        >
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
                </div>

                {/* Meta */}
                <div className="board-card-meta">
                    {card.priority && card.priority !== 'none' && (
                        <span className="board-card-priority" style={{ color: priorityConfig[card.priority]?.color }}>
                            <AlertCircle size={12} />
                            {priorityConfig[card.priority]?.label}
                        </span>
                    )}

                    {card.dueDate && (
                        <span className={`board-card-due ${isOverdue ? 'overdue' : ''} ${isToday(new Date(card.dueDate)) ? 'today' : ''}`}>
                            <Calendar size={12} />
                            {format(new Date(card.dueDate), 'dd MMM', { locale: ptBR })}
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
