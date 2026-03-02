import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../context/ThemeContext';
import { Plus } from 'lucide-react';
import { endOfWeek, endOfMonth, endOfYear } from 'date-fns';
import SmartTaskItem from '../SmartViews/SmartTaskItem';

const PERIODS = [
    { id: 'day', label: 'Dia' },
    { id: 'week', label: 'Semana' },
    { id: 'month', label: 'Mês' },
    { id: 'year', label: 'Ano' },
];

const CHARGES = [
    { id: 'none', label: 'Sem cobrança' },
    { id: 'daily', label: 'Diária' },
    { id: 'weekly', label: 'Semanal' },
    { id: 'monthly', label: 'Mensal' },
];

export default function DiaryQuickPlanner({ onCardClick }) {
    const { state, getMyDayCards, getActiveBoard, dispatch, persistBoard } = useApp();
    const t = useI18n();

    const boards = state.boards || [];
    const activeBoard = getActiveBoard();

    const [period, setPeriod] = useState('day');
    const [title, setTitle] = useState('');
    const [selectedBoardId, setSelectedBoardId] = useState(() => activeBoard?.id || boards[0]?.id || null);
    const [selectedListId, setSelectedListId] = useState(() => {
        const board = activeBoard || boards[0];
        if (!board) return null;
        const nonDone = board.lists.find(l => !l.isCompletionList) || board.lists[0];
        return nonDone?.id ?? null;
    });
    const [charge, setCharge] = useState('none');
    const [timeValue, setTimeValue] = useState('');
    const [timeUnit, setTimeUnit] = useState('min');

    const listsForBoard = useMemo(() => {
        if (!selectedBoardId) return [];
        const board = boards.find(b => b.id === selectedBoardId);
        return board?.lists || [];
    }, [boards, selectedBoardId]);

    const myDayCards = getMyDayCards();
    const quickPlannerCards = myDayCards
        .filter(c => c.journalMeta?.period === period)
        .slice()
        .sort((a, b) => {
            const aDate = new Date(a.createdAt || a.dueDate || 0).getTime();
            const bDate = new Date(b.createdAt || b.dueDate || 0).getTime();
            return bDate - aDate;
        })
        .slice(0, 5);

    const handleChangeBoard = (boardId) => {
        setSelectedBoardId(boardId);
        const board = boards.find(b => b.id === boardId);
        if (!board) {
            setSelectedListId(null);
            return;
        }
        const nonDone = board.lists.find(l => !l.isCompletionList) || board.lists[0];
        setSelectedListId(nonDone?.id ?? null);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const trimmedTitle = title.trim();
        if (!trimmedTitle || !selectedBoardId || !selectedListId) return;

        const now = new Date();
        let dueDate = now;
        if (period === 'week') {
            dueDate = endOfWeek(now, { weekStartsOn: 1 });
        } else if (period === 'month') {
            dueDate = endOfMonth(now);
        } else if (period === 'year') {
            dueDate = endOfYear(now);
        }

        const numericTime = parseInt(timeValue, 10);
        const estimatedMinutes = Number.isFinite(numericTime)
            ? numericTime * (timeUnit === 'h' ? 60 : 1)
            : null;

        dispatch({
            type: 'ADD_CARD',
            payload: {
                boardId: selectedBoardId,
                listId: selectedListId,
                title: trimmedTitle,
                cardData: {
                    myDay: true,
                    dueDate: dueDate.toISOString(),
                    journalMeta: {
                        period,
                        charge,
                        estimatedMinutes,
                    },
                },
            },
        });
        persistBoard(selectedBoardId);
        setTitle('');
        setTimeValue('');
    };

    const isSubmitDisabled = !title.trim() || !selectedBoardId || !selectedListId;

    return (
        <section className="diary-column diary-column-center">
            <div className="diary-column-header diary-column-header-quick">
                <div>
                    <div className="diary-column-title">
                        Plano rápido pra HOJE – Organizar
                    </div>
                    <div className="diary-column-subtitle">
                        Crie tarefas focadas para o dia, semana, mês ou ano sem sair do Diário.
                    </div>
                </div>
                <div className="diary-period-toggle" aria-label="Período do objetivo">
                    {PERIODS.map(p => (
                        <button
                            key={p.id}
                            type="button"
                            className={`diary-period-chip ${period === p.id ? 'active' : ''}`}
                            onClick={() => setPeriod(p.id)}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            <form className="diary-quick-form" onSubmit={handleSubmit}>
                <input
                    type="text"
                    className="diary-quick-input"
                    placeholder="Descreva rapidamente o objetivo..."
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                />

                <div className="diary-quick-row">
                    <div className="diary-quick-field">
                        <label className="diary-quick-label">Board</label>
                        <select
                            className="diary-quick-select"
                            value={selectedBoardId || ''}
                            onChange={e => handleChangeBoard(e.target.value || null)}
                        >
                            {boards.length === 0 && <option value="">Nenhum board disponível</option>}
                            {boards.map(board => (
                                <option key={board.id} value={board.id}>
                                    {board.emoji} {board.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="diary-quick-field">
                        <label className="diary-quick-label">Lista</label>
                        <select
                            className="diary-quick-select"
                            value={selectedListId || ''}
                            onChange={e => setSelectedListId(e.target.value || null)}
                            disabled={!selectedBoardId}
                        >
                            {(!listsForBoard || listsForBoard.length === 0) && (
                                <option value="">Nenhuma lista</option>
                            )}
                            {listsForBoard.map(list => (
                                <option key={list.id} value={list.id}>
                                    {list.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="diary-quick-field">
                        <label className="diary-quick-label">Cobrança</label>
                        <select
                            className="diary-quick-select"
                            value={charge}
                            onChange={e => setCharge(e.target.value)}
                        >
                            {CHARGES.map(c => (
                                <option key={c.id} value={c.id}>{c.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="diary-quick-field diary-quick-time">
                        <label className="diary-quick-label">Tempo</label>
                        <div className="diary-quick-time-inputs">
                            <input
                                type="number"
                                min="0"
                                className="diary-quick-input-mini"
                                value={timeValue}
                                onChange={e => setTimeValue(e.target.value)}
                                placeholder="0"
                            />
                            <select
                                className="diary-quick-select-mini"
                                value={timeUnit}
                                onChange={e => setTimeUnit(e.target.value)}
                            >
                                <option value="min">min</option>
                                <option value="h">h</option>
                            </select>
                        </div>
                    </div>

                    <div className="diary-quick-actions">
                        <button
                            type="submit"
                            className="btn btn-primary diary-quick-submit"
                            disabled={isSubmitDisabled}
                        >
                            <Plus size={16} />
                            Adicionar
                        </button>
                    </div>
                </div>
            </form>

            {quickPlannerCards.length > 0 && (
                <div className="diary-quick-list">
                    <div className="diary-quick-list-header">
                        <span className="diary-quick-list-title">
                            Criados para este período
                        </span>
                        <span className="diary-quick-list-count">
                            {quickPlannerCards.length} tarefa{quickPlannerCards.length > 1 ? 's' : ''}
                        </span>
                    </div>
                    <div className="diary-quick-list-body">
                        {quickPlannerCards.map(card => (
                            <SmartTaskItem
                                key={card.id}
                                card={card}
                                board={{ id: card.boardId, title: card.boardTitle, emoji: card.boardEmoji }}
                                list={{ id: card.listId, title: card.listTitle }}
                                onClick={() => onCardClick(card, card.boardId, card.listId)}
                                onToggleMyDay={null}
                                onToggleImportant={null}
                                showLocation={true}
                            />
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}

