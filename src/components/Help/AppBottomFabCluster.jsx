import AppHelpWidget from './AppHelpWidget';
import ChatWidget from '../Chat/ChatWidget';
import './AppBottomFabCluster.css';

/** Painéis flutuantes de chat e ajuda (abrem pelo cabeçalho/sidebar; sem botões por cima do conteúdo). */
export default function AppBottomFabCluster({ onNavigateView }) {
    return (
        <div className="app-bottom-fab-cluster">
            <div className="app-bottom-fab-cluster-chat">
                <ChatWidget />
            </div>
            <div className="app-bottom-fab-cluster-help">
                <AppHelpWidget onNavigateView={onNavigateView} />
            </div>
        </div>
    );
}
