import { useApp } from '../../context/AppContext';
import { Cloud, CloudOff, Loader2 } from 'lucide-react';
import './FloatingSaveButton.css';

/**
 * Botão flutuante que aparece quando há alterações locais ainda não persistidas no servidor.
 * - Estado "pendente": debounce agendado — mostra "Alterações não salvas" + botão "Salvar agora"
 * - Estado "salvando": I/O em andamento — mostra spinner
 * - Estado limpo: oculto
 */
export default function FloatingSaveButton() {
    const { hasUnsavedChanges, saveAllPending, savingBoardIds, state } = useApp();
    const isSaving = savingBoardIds.length > 0;

    const getSavingText = () => {
        if (!isSaving) return 'Alterações não salvas';
        if (savingBoardIds.length === 1) {
            const board = state.boards.find(b => b.id === savingBoardIds[0]);
            return board ? `Salvando: ${board.title}` : 'Salvando...';
        }
        return `Salvando ${savingBoardIds.length} boards...`;
    };

    if (!hasUnsavedChanges) return null;

    return (
        <div className={`floating-save${isSaving ? ' floating-save--saving' : ''} animate-slide-up`}>
            <div className="floating-save-status">
                {isSaving
                    ? <Loader2 size={14} className="spinning" />
                    : <CloudOff size={14} />
                }
                <span>{getSavingText()}</span>
            </div>
            {!isSaving && (
                <button
                    className="floating-save-btn"
                    onClick={saveAllPending}
                    title="Salvar agora no servidor"
                >
                    <Cloud size={14} />
                    Salvar agora
                </button>
            )}
        </div>
    );
}
