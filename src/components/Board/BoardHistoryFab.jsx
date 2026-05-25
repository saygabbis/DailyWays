import { Undo2, Redo2 } from 'lucide-react';
import { useBoardUndo } from '../../hooks/useBoardUndo';
import './BoardHistoryFab.css';

export default function BoardHistoryFab({ boardId }) {
    const { undo, redo, canUndo, canRedo } = useBoardUndo(boardId);

    if (!boardId) return null;

    return (
        <div className="board-history-fab" role="group" aria-label="Desfazer e refazer">
            <button
                type="button"
                className={`board-history-fab-btn${canUndo ? ' is-available' : ''}`}
                disabled={!canUndo}
                onClick={() => undo()}
                title={canUndo ? 'Desfazer (Ctrl+Z)' : 'Nada para desfazer'}
                aria-label={canUndo ? 'Desfazer' : 'Desfazer indisponível'}
            >
                <Undo2 size={20} strokeWidth={2.25} />
            </button>
            <button
                type="button"
                className={`board-history-fab-btn${canRedo ? ' is-available' : ''}`}
                disabled={!canRedo}
                onClick={() => redo()}
                title={canRedo ? 'Refazer (Ctrl+Shift+Z)' : 'Nada para refazer'}
                aria-label={canRedo ? 'Refazer' : 'Refazer indisponível'}
            >
                <Redo2 size={20} strokeWidth={2.25} />
            </button>
        </div>
    );
}
