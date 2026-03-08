import { useState } from 'react';
import { AlertTriangle, RotateCcw, RefreshCw, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import './FloatingSaveError.css';

/**
 * Painel flutuante que aparece quando um save falha.
 * Oferece duas ações:
 *   - Tentar novamente: força o save com token fresco (retornar ao trilho)
 *   - Reverter: busca o estado salvo no servidor e restaura
 */
export default function FloatingSaveError() {
    const { saveErrors, retryFailedSave, revertFailedSave } = useApp();
    const [busyId, setBusyId] = useState(null);

    // Exibe apenas o erro mais recente (LIFO)
    const error = saveErrors[saveErrors.length - 1] ?? null;
    if (!error) return null;

    const isBusy = busyId === error.boardId;

    const handleRetry = async () => {
        setBusyId(error.boardId);
        try {
            await retryFailedSave(error.boardId, error.boardSnapshot);
        } finally {
            setBusyId(null);
        }
    };

    const handleRevert = async () => {
        setBusyId(error.boardId);
        try {
            await revertFailedSave(error.boardId);
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="floating-save-error animate-slide-up" role="alert">
            <div className="floating-save-error-header">
                <AlertTriangle size={14} />
                <span>Falha ao salvar</span>
            </div>
            {error.boardTitle && (
                <div className="floating-save-error-board" title={error.boardTitle}>
                    {error.boardTitle}
                </div>
            )}
            <div className="floating-save-error-actions">
                <button
                    className="floating-save-error-btn floating-save-error-btn--retry"
                    onClick={handleRetry}
                    disabled={isBusy}
                    title="Tentar salvar novamente com sessão atualizada"
                >
                    {isBusy
                        ? <Loader2 size={12} className="spinning" />
                        : <RefreshCw size={12} />
                    }
                    Tentar novamente
                </button>
                <button
                    className="floating-save-error-btn floating-save-error-btn--revert"
                    onClick={handleRevert}
                    disabled={isBusy}
                    title="Descartar alterações e voltar ao estado salvo no servidor"
                >
                    <RotateCcw size={12} />
                    Reverter
                </button>
            </div>
        </div>
    );
}
