import { useEffect, useMemo, useState } from 'react';
import { Users, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { fetchMyInvitations } from '../../services/boardService';
import './FloatingInvitationToast.css';

export default function FloatingInvitationToast() {
    const { user } = useAuth();
    const [toast, setToast] = useState(null);

    const lastSeenKey = useMemo(() => (user?.id ? `dailyways_invite_last_seen_${user.id}` : null), [user?.id]);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (!user?.id || !lastSeenKey) return;
            try {
                const { data, error } = await fetchMyInvitations();
                if (cancelled) return;
                if (error) return;

                const lastSeenRaw = window.localStorage.getItem(lastSeenKey);
                const lastSeenAt = lastSeenRaw ? Number(lastSeenRaw) : 0;

                // pega as mais recentes que não existiam no "last seen"
                const newlyCreated = (data || []).filter(inv => {
                    const createdAt = inv.createdAt ? new Date(inv.createdAt).getTime() : 0;
                    return createdAt > lastSeenAt;
                });

                if (newlyCreated.length > 0) {
                    // mostra só 1 toast por vez (o mais recente)
                    const newest = newlyCreated.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                    setToast(newest);
                }

                // atualiza lastSeen para agora (evita spam)
                window.localStorage.setItem(lastSeenKey, String(Date.now()));
            } catch (_) {
                // ignore
            }
        };

        run();
        return () => {
            cancelled = true;
        };
    }, [user?.id, lastSeenKey]);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 4500);
        return () => clearTimeout(t);
    }, [toast]);

    if (!toast) return null;

    return (
        <div className="floating-invitation-toast animate-slide-up" role="status" aria-live="polite">
            <div className="floating-invitation-toast-header">
                <Users size={14} />
                <span>Convite de board</span>
                <button className="floating-invitation-toast-close btn-icon" onClick={() => setToast(null)} aria-label="Fechar">
                    <X size={16} />
                </button>
            </div>
            <div className="floating-invitation-toast-body">
                <div className="floating-invitation-toast-board">{toast.boardTitle}</div>
                <div className="floating-invitation-toast-meta">
                    Acesso como <strong>{toast.role === 'editor' ? 'Editor' : 'Leitor'}</strong>
                </div>
            </div>
        </div>
    );
}

