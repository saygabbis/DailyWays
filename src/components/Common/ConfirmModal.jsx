import './ConfirmModal.css';
import { AlertTriangle, Info, X } from 'lucide-react';

export default function ConfirmModal({
    show,
    title,
    message,
    onConfirm,
    onCancel,
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    type = 'danger'
}) {
    if (!show) return null;

    return (
        <>
            <div className="modal-backdrop" onClick={onCancel} style={{ zIndex: 300 }} />
            <div className="confirm-modal animate-scale-in-centered">
                <div className="confirm-modal-header">
                    <div className={`confirm-modal-icon ${type}`}>
                        {type === 'danger' ? <AlertTriangle size={24} /> : <Info size={24} />}
                    </div>
                    <button className="confirm-modal-close btn-icon" onClick={onCancel}>
                        <X size={20} />
                    </button>
                </div>

                <div className="confirm-modal-content">
                    <h3>{title}</h3>
                    <p>{message}</p>
                </div>

                <div className="confirm-modal-actions">
                    <button className="btn btn-ghost" onClick={onCancel}>
                        {cancelLabel}
                    </button>
                    <button
                        className={`btn ${type === 'danger' ? 'btn-danger' : 'btn-primary'}`}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </>
    );
}
