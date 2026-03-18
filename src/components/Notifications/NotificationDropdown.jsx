import { useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import './Notification.css';
import { useAuth } from '../../context/AuthContext';
import { fetchMyInvitations } from '../../services/boardService';

export default function NotificationDropdown({ onClose, onOpenInvitations }) {
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [invitations, setInvitations] = useState([]);
    const [readIds, setReadIds] = useState(() => new Set());

    const readKey = useMemo(() => (user?.id ? `dailyways_invite_read_${user.id}` : null), [user?.id]);

    const loadReadIds = () => {
        if (!readKey) return new Set();
        try {
            const raw = window.localStorage.getItem(readKey);
            const arr = raw ? JSON.parse(raw) : [];
            return new Set(Array.isArray(arr) ? arr : []);
        } catch (_) {
            return new Set();
        }
    };

    useEffect(() => {
        setReadIds(loadReadIds());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [readKey]);

    const loadInvites = async () => {
        if (!user?.id) return;
        setLoading(true);
        setError('');
        try {
            const { data, error: err } = await fetchMyInvitations();
            if (err) setError(err || 'Erro ao carregar convites.');
            setInvitations(data || []);
        } catch (e) {
            setError(e?.message || 'Erro ao carregar convites.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadInvites();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    const notifications = useMemo(() => {
        return (invitations || []).map((inv) => ({
            id: inv.id,
            type: 'invitation',
            avatar: (inv.boardEmoji || '📋')[0],
            user: inv.inviteeEmail || 'Convite',
            text: 'foi convidado para',
            target: inv.boardTitle,
            time: inv.createdAt ? new Date(inv.createdAt).toLocaleString() : '',
            read: readIds.has(inv.id),
        }));
    }, [invitations, readIds]);

    const persistReadIds = (nextSet) => {
        if (!readKey) return;
        try {
            window.localStorage.setItem(readKey, JSON.stringify(Array.from(nextSet)));
        } catch (_) { }
    };

    const markAllRead = () => {
        const next = new Set(notifications.map(n => n.id));
        setReadIds(next);
        persistReadIds(next);
    };

    const handleClick = (id) => {
        setReadIds((prev) => {
            const next = new Set(prev);
            next.add(id);
            persistReadIds(next);
            return next;
        });

        // Abre diretamente a seção de convites do painel de configurações.
        if (typeof onOpenInvitations === 'function') onOpenInvitations();
    };

    return (
        <>
            <div className="notification-backdrop" onClick={onClose} />
            <div className="notification-dropdown animate-pop-in">
                <div className="notification-header">
                    <h3>Notificações</h3>
                    <button className="btn-text btn-xs" onClick={markAllRead}>
                        Marcar todas como lidas
                    </button>
                </div>

                <div className="notification-list">
                    {loading && (
                        <div className="notification-empty">
                            <p>Carregando...</p>
                        </div>
                    )}

                    {!loading && error && (
                        <div className="notification-empty" style={{ color: 'var(--danger)' }}>
                            {error}
                        </div>
                    )}

                    {!loading && !error && notifications.length === 0 && (
                        <div className="notification-empty">
                            <Bell size={24} />
                            <p>Nenhuma notificação nova</p>
                        </div>
                    )}

                    {!loading && !error && notifications.length > 0 && (
                        notifications.map(n => (
                            <div
                                key={n.id}
                                className={`notification-item ${!n.read ? 'unread' : ''}`}
                                onClick={() => handleClick(n.id)}
                            >
                                <div className={`notification-avatar ${n.type}`}>
                                    {n.avatar}
                                </div>
                                <div className="notification-content">
                                    <p>
                                        <span className="notification-user">{n.user}</span> {n.text} <span className="notification-target">{n.target}</span>
                                    </p>
                                    <span className="notification-time">{n.time}</span>
                                </div>
                                {!n.read && <div className="notification-dot" />}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
}
