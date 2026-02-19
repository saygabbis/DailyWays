import { useState } from 'react';
import { Bell, Check, Clock, MessageSquare, User } from 'lucide-react';
import './Notification.css';

const MOCK_NOTIFICATIONS = [
    {
        id: 1,
        type: 'mention',
        user: 'Alice Silva',
        avatar: 'AS',
        text: 'mencionou você em',
        target: 'Design System',
        time: '2 min atrás',
        read: false,
    },
    {
        id: 2,
        type: 'assignment',
        user: 'Bob Jones',
        avatar: 'BJ',
        text: 'atribuiu a você',
        target: 'API Integration',
        time: '1h atrás',
        read: false,
    },
    {
        id: 3,
        type: 'reminder',
        user: 'System',
        avatar: <Clock size={14} />,
        text: 'Lembrete: vencer hoje',
        target: 'Revisão Mensal',
        time: '3h atrás',
        read: true,
    },
    {
        id: 4,
        type: 'comment',
        user: 'Alice Silva',
        avatar: 'AS',
        text: 'comentou em',
        target: 'Bug #124',
        time: 'Ontem',
        read: true,
    }
];

export default function NotificationDropdown({ onClose }) {
    const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

    const markAllRead = () => {
        setNotifications(notifications.map(n => ({ ...n, read: true })));
    };

    const handleClick = (id) => {
        setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
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
                    {notifications.length === 0 ? (
                        <div className="notification-empty">
                            <Bell size={24} />
                            <p>Nenhuma notificação nova</p>
                        </div>
                    ) : (
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
