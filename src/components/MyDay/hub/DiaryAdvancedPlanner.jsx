import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import DiaryQuickPlanner from '../DiaryQuickPlanner';

export default function DiaryAdvancedPlanner({ open, onClose, onCardClick }) {
    if (!open) return null;

    return createPortal(
        <div className="diary-drawer-backdrop" onClick={onClose}>
            <div className="diary-drawer" onClick={e => e.stopPropagation()}>
                <div className="diary-drawer-header">
                    <div>
                        <h2>Planejamento avançado</h2>
                        <p>Organize por período, board e tempo estimado</p>
                    </div>
                    <button type="button" className="btn-icon" onClick={onClose} aria-label="Fechar">
                        <X size={20} />
                    </button>
                </div>
                <div className="diary-drawer-body">
                    <DiaryQuickPlanner onCardClick={onCardClick} inDrawer />
                </div>
            </div>
        </div>,
        document.body
    );
}
