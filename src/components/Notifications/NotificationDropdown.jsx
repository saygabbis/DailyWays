import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Check, X } from 'lucide-react';
import './Notification.css';

export default function NotificationDropdown({
    anchorRef,
    open,
    onClose,
    notifications,
    loading,
    unreadCount,
    onMarkAllRead,
    onItemClick,
    onAccept,
    onDecline,
}) {
    const [position, setPosition] = useState({ top: 0, right: 16 });

    useEffect(() => {
        if (!open || !anchorRef?.current) return;

        const updatePosition = () => {
            const rect = anchorRef.current.getBoundingClientRect();
            setPosition({
                top: rect.bottom + 8,
                right: Math.max(12, window.innerWidth - rect.right),
            });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [open, anchorRef]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    return createPortal(
        <>
            <div className="notification-backdrop" onClick={onClose} />
            <div
                className="notification-dropdown animate-pop-in"
                style={{
                    top: position.top,
                    right: position.right,
                }}
                role="dialog"
                aria-label="Notificações"
            >
                <div className="notification-header">
                    <div>
                        <h3>Notificações</h3>
                        {unreadCount > 0 && (
                            <span className="notification-header-count">
                                {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                    {notifications.length > 0 && (
                        <button type="button" className="btn-text btn-xs" onClick={onMarkAllRead}>
                            Marcar todas como lidas
                        </button>
                    )}
                </div>

                <div className="notification-list">
                    {loading && (
                        <div className="notification-empty">
                            <p>Carregando...</p>
                        </div>
                    )}

                    {!loading && notifications.length === 0 && (
                        <div className="notification-empty">
                            <Bell size={24} />
                            <p>Nenhuma notificação nova</p>
                        </div>
                    )}

                    {!loading && notifications.map((n) => (
                        <div
                            key={n.id}
                            className={`notification-item ${!n.read ? 'unread' : ''}`}
                        >
                            <div className="notification-item-main" onClick={() => onItemClick?.(n.id)}>
                                <div className={`notification-avatar ${n.type}`}>
                                    {n.kind === 'space' ? (n.spaceEmoji || '🌌') : (n.boardEmoji || '📋')}
                                </div>
                                <div className="notification-content">
                                    <p>
                                        Convite para {n.kind === 'space' ? 'o space' : 'o board'}{' '}
                                        <span className="notification-target">
                                            {n.kind === 'space' ? n.spaceTitle : n.boardTitle}
                                        </span>
                                    </p>
                                    <span className="notification-meta">
                                        Acesso como {n.role === 'editor' ? 'Editor' : 'Leitor'}
                                    </span>
                                    <span className="notification-time">{n.time}</span>
                                </div>
                                {!n.read && <div className="notification-dot" />}
                            </div>
                            <div className="notification-item-actions">
                                <button
                                    type="button"
                                    className="notification-action-btn accept"
                                    title="Aceitar"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onAccept?.(n);
                                    }}
                                >
                                    <Check size={14} />
                                </button>
                                <button
                                    type="button"
                                    className="notification-action-btn decline"
                                    title="Recusar"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDecline?.(n);
                                    }}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>,
        document.body
    );
}
