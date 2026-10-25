import { useEffect } from 'react';
import { X, Trash2, ListChecks } from 'lucide-react';
import { useBoardSelectionStore } from '../../stores/boardSelectionStore';

const COLORS = [null, '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'];

/** Ações nas colunas selecionadas (Ctrl/Cmd+clique no título): cor, selecionar os cards, excluir. */
export default function ListSelectionBar({ board, collabDispatch, showConfirm }) {
    const selectedListIds = useBoardSelectionStore((s) => s.selectedListIds);
    const clearLists = useBoardSelectionStore((s) => s.clearLists);
    const selectMany = useBoardSelectionStore((s) => s.selectMany);
    const lists = board.lists.filter((l) => selectedListIds.includes(l.id));

    useEffect(() => {
        if (!selectedListIds.length) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') clearLists();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selectedListIds.length, clearLists]);

    // coluna apagada por outra pessoa sai da seleção
    useEffect(() => {
        if (selectedListIds.length && lists.length !== selectedListIds.length) {
            useBoardSelectionStore.setState({ selectedListIds: lists.map((l) => l.id) });
        }
    }, [lists, selectedListIds.length]);

    if (!lists.length) return null;
    const n = lists.length;

    const setColor = (color) => {
        for (const l of lists) {
            collabDispatch({ type: 'UPDATE_LIST', payload: { boardId: board.id, listId: l.id, updates: { color } } });
        }
    };

    const selectCards = () => {
        const ids = lists.flatMap((l) => l.cards.map((c) => c.id));
        if (ids.length) selectMany(ids, lists[0].id);
        clearLists();
    };

    const remove = async () => {
        const cards = lists.reduce((acc, l) => acc + l.cards.length, 0);
        const ok = await showConfirm({
            title: n === 1 ? 'Excluir coluna' : `Excluir ${n} colunas`,
            message: cards
                ? `As colunas e as ${cards} tarefas dentro delas serão excluídas.`
                : 'As colunas selecionadas serão excluídas.',
            confirmLabel: 'Excluir',
            type: 'danger',
        });
        if (!ok) return;
        for (const l of lists) collabDispatch({ type: 'DELETE_LIST', payload: { boardId: board.id, listId: l.id } });
        clearLists();
    };

    return (
        <div className="list-selection-bar" role="toolbar" aria-label="Colunas selecionadas">
            <span className="list-selection-count">{n === 1 ? '1 coluna' : `${n} colunas`}</span>
            <span className="list-selection-sep" aria-hidden />
            <div className="list-selection-colors" role="group" aria-label="Cor das colunas">
                {COLORS.map((c) => (
                    <button
                        key={c ?? 'none'}
                        type="button"
                        className={`list-selection-swatch ${c ? '' : 'is-none'}`}
                        style={c ? { background: c } : undefined}
                        aria-label={c ? `Cor ${c}` : 'Sem cor'}
                        title={c ? c : 'Sem cor'}
                        onClick={() => setColor(c)}
                    />
                ))}
            </div>
            <span className="list-selection-sep" aria-hidden />
            <button type="button" className="list-selection-btn" onClick={selectCards}>
                <ListChecks size={15} aria-hidden /> Selecionar tarefas
            </button>
            <button type="button" className="list-selection-btn is-danger" onClick={remove}>
                <Trash2 size={15} aria-hidden /> Excluir
            </button>
            <button type="button" className="list-selection-close" onClick={clearLists} aria-label="Limpar seleção (Esc)" title="Limpar seleção (Esc)">
                <X size={16} />
            </button>
        </div>
    );
}
