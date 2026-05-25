import { useEffect, useState } from 'react';
import { Users, X } from 'lucide-react';
import './FloatingInvitationToast.css';

/** Toast discreto perto do header quando chega convite em tempo real. */
export default function FloatingInvitationToast() {
    const [toast, setToast] = useState(null);

    useEffect(() => {
        const onNew = (e) => {
            const list = e.detail?.invitations;
            if (!list?.length) return;
            const newest = [...list].sort(
                (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
            )[0];
            setToast(newest);
        };
        window.addEventListener('notifications-new', onNew);
        return () => window.removeEventListener('notifications-new', onNew);
    }, []);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 6000);
        return () => clearTimeout(t);
    }, [toast]);

    if (!toast) return null;

    return (
        <div className="floating-invitation-toast animate-slide-up" role="status" aria-live="polite">
            <div className="floating-invitation-toast-header">
                <Users size={14} />
                <span>Novo convite</span>
                <button
                    type="button"
                    className="floating-invitation-toast-close btn-icon"
                    onClick={() => setToast(null)}
                    aria-label="Fechar"
                >
                    <X size={16} />
                </button>
            </div>
            <div className="floating-invitation-toast-body">
                <div className="floating-invitation-toast-board">
                    {toast.boardEmoji} {toast.boardTitle || 'Board compartilhado'}
                </div>
                <div className="floating-invitation-toast-meta">
                    Acesso como <strong>{toast.role === 'editor' ? 'Editor' : 'Leitor'}</strong>
                </div>
            </div>
        </div>
    );
}
