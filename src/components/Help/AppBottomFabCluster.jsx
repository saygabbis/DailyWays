import AppHelpWidget from './AppHelpWidget';
import BoardHistoryFab from '../Board/BoardHistoryFab';
import './AppBottomFabCluster.css';

/** Undo/redo + ajuda (?) no canto inferior direito */
export default function AppBottomFabCluster({ boardId, showBoardHistory, onNavigateView }) {
    return (
        <div className="app-bottom-fab-cluster">
            {showBoardHistory && boardId ? <BoardHistoryFab boardId={boardId} /> : null}
            <div className="app-bottom-fab-cluster-help">
                <AppHelpWidget onNavigateView={onNavigateView} />
            </div>
        </div>
    );
}
