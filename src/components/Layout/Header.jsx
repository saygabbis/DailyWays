import { useState, useRef, useEffect } from 'react';
import { Search, Menu, X, Bell, Settings, User, LogOut, ChevronDown, Layout, Share2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../context/ThemeContext';
import { useNotifications } from '../../hooks/useNotifications';
import { acceptInvitation, declineInvitation } from '../../services/boardService';
import { respondToContactRequest } from '../../services/contactsService';
import NotificationDropdown from '../Notifications/NotificationDropdown';
import BoardDetailsModal from '../Sidebar/BoardDetailsModal';
import CloudSyncIndicator from './CloudSyncIndicator';
import HeaderStreakButton from './HeaderStreakButton';
import './Header.css';

export default function Header({ title, subtitle, onMenuClick, sidebarOpen, onOpenSettings, onOpenSearch, onOpenDiary, editableBoardTitle, editableSpaceTitle, variant = 'default' }) {
    const { user, logout } = useAuth();
    const { getActiveBoard, showBoardToolbar, dispatch, showConfirm, reloadBoards } = useApp();
    const t = useI18n();
    const {
        notifications,
        unreadCount,
        loading: notificationsLoading,
        refresh: refreshNotifications,
        markRead,
        markAllRead,
    } = useNotifications();

    const [showProfile, setShowProfile] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [editingBoardTitle, setEditingBoardTitle] = useState(false);
    const [editBoardTitleValue, setEditBoardTitleValue] = useState('');
    const profileRef = useRef(null);
    const bellRef = useRef(null);
    const notificationsRef = useRef(null);

    const activeBoard = getActiveBoard();

    const editableTitle = editableBoardTitle || editableSpaceTitle;
    const currentEditableValue = editableBoardTitle?.board?.title ?? editableSpaceTitle?.space?.title ?? '';

    const handleStartEditBoardTitle = () => {
        if (!editableTitle) return;
        setEditBoardTitleValue(currentEditableValue);
        setEditingBoardTitle(true);
    };

    const handleSaveBoardTitle = (e) => {
        if (e) e.preventDefault();
        const trimmed = editBoardTitleValue.trim();
        setEditingBoardTitle(false);
        if (trimmed && editableTitle?.onSave) editableTitle.onSave(trimmed);
    };

    const firstName = user?.name?.split(' ')[0] || 'Usuário';

    const handleLogout = async () => {
        setShowProfile(false);
        const confirmed = await showConfirm({
            title: 'Sair da Conta',
            message: 'Tem certeza que deseja encerrar sua sessão?',
            confirmLabel: 'Sair',
            cancelLabel: 'Manter conectado',
            type: 'danger'
        });
        if (confirmed) logout();
    };

    useEffect(() => {
        if (!showProfile) return;
        const handleClick = (e) => {
            if (profileRef.current && !profileRef.current.contains(e.target)) {
                setShowProfile(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showProfile]);

    useEffect(() => {
        if (!showNotifications) return;
        const handleClick = (e) => {
            const inProfile = profileRef.current?.contains(e.target);
            const inNotif = notificationsRef.current?.contains(e.target);
            const inDropdown = e.target.closest?.('.notification-dropdown, .notification-backdrop');
            if (!inProfile && !inNotif && !inDropdown) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showNotifications]);

    useEffect(() => {
        dispatch({ type: 'SET_PROFILE_MENU_OPEN', payload: showProfile });
    }, [showProfile, dispatch]);

    const handleNotificationItemClick = (notification) => {
        markRead(notification);
        setShowNotifications(false);
        if (notification?.type === 'contact_request') {
            window.dispatchEvent(new CustomEvent('app-navigate-view', { detail: { view: 'contacts' } }));
            onOpenSettings?.('contacts');
        } else if (
            notification?.type === 'contact_accepted'
            || notification?.type === 'contact_declined'
        ) {
            window.dispatchEvent(new CustomEvent('app-navigate-view', { detail: { view: 'contacts' } }));
            onOpenSettings?.('contacts');
        } else if (notification?.type === 'chat_message') {
            window.dispatchEvent(new CustomEvent('app-chat-open', {
                detail: {
                    conversationId: notification.conversationId,
                    userId: notification.fromUserId,
                },
            }));
        } else {
            onOpenSettings?.('invitations');
        }
    };

    const handleAcceptNotification = async (notification) => {
        if (!notification) return;
        markRead(notification);

        if (notification.type === 'contact_request') {
            const { success, error } = await respondToContactRequest(notification.id, 'accepted');
            if (success) {
                await refreshNotifications();
                window.dispatchEvent(new CustomEvent('contacts-updated'));
            } else if (error) console.error('[Header] accept contact request', error);
            return;
        }

        const kind = notification.kind || 'board';
        const { success, error } = await acceptInvitation(notification.id, kind);
        if (success) {
            if (kind === 'space') {
                window.location.reload();
            } else {
                await reloadBoards?.();
            }
            await refreshNotifications();
        } else if (error) {
            console.error('[Header] accept invitation', error);
        }
    };

    const handleDeclineNotification = async (notification) => {
        if (!notification) return;
        markRead(notification);

        if (notification.type === 'contact_request') {
            const { success } = await respondToContactRequest(notification.id, 'declined');
            if (success) {
                await refreshNotifications();
                window.dispatchEvent(new CustomEvent('contacts-updated'));
            }
            return;
        }

        const kind = notification.kind || 'board';
        const { success } = await declineInvitation(notification.id, kind);
        if (success) await refreshNotifications();
    };

    useEffect(() => {
        const onOpen = (e) => {
            const n = e.detail?.notification;
            if (n) handleNotificationItemClick(n);
        };
        const onAccept = (e) => {
            const n = e.detail?.notification;
            if (n) void handleAcceptNotification(n);
        };
        const onDecline = (e) => {
            const n = e.detail?.notification;
            if (n) void handleDeclineNotification(n);
        };
        window.addEventListener('app-notification-open', onOpen);
        window.addEventListener('app-notification-accept', onAccept);
        window.addEventListener('app-notification-decline', onDecline);
        return () => {
            window.removeEventListener('app-notification-open', onOpen);
            window.removeEventListener('app-notification-accept', onAccept);
            window.removeEventListener('app-notification-decline', onDecline);
        };
    });

    const hasUnread = unreadCount > 0;

    return (
        <header className={`header ${variant === 'workspace' ? 'header--workspace' : ''}`}>
            <div className="header-left">
                <button className="btn-icon header-menu" onClick={onMenuClick} aria-label="Menu">
                    {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
                </button>
                <div className="header-title-group">
                    {editableTitle && editingBoardTitle ? (
                        <form onSubmit={handleSaveBoardTitle} className="header-title-edit-form">
                            <input
                                type="text"
                                className="header-title-edit-input"
                                value={editBoardTitleValue}
                                onChange={e => setEditBoardTitleValue(e.target.value)}
                                onBlur={handleSaveBoardTitle}
                                onKeyDown={e => e.key === 'Escape' && setEditingBoardTitle(false)}
                                autoFocus
                                aria-label="Nome do quadro"
                            />
                        </form>
                    ) : editableTitle ? (
                        <h1
                            className="header-title header-title-editable"
                            onClick={handleStartEditBoardTitle}
                            title="Clique para renomear"
                        >
                            {title}
                        </h1>
                    ) : (
                        <h1 className="header-title">{title}</h1>
                    )}
                    {subtitle && <span className="header-subtitle">{subtitle}</span>}
                </div>
            </div>

            <div className="header-right">
                <CloudSyncIndicator />

                <button className="header-search-btn" onClick={onOpenSearch}>
                    <div className="header-search-btn-content">
                        <span>{t.search}</span>
                        <kbd className="header-search-kbd">Ctrl+K</kbd>
                    </div>
                    <Search size={18} className="header-search-btn-icon" />
                </button>

                {(editableBoardTitle || editableSpaceTitle) && (
                    <button className="btn-icon header-icon-btn" title="Compartilhar" onClick={() => setShowShareModal(true)}>
                        <Share2 size={18} />
                    </button>
                )}

                <HeaderStreakButton onOpenDiary={onOpenDiary} />

                <div className="header-notifications" ref={notificationsRef}>
                    <button
                        ref={bellRef}
                        type="button"
                        className={`btn-icon header-icon-btn header-notifications-btn ${hasUnread ? 'has-unread' : ''}`}
                        title={hasUnread ? `${unreadCount} notificação(ões)` : 'Notificações'}
                        aria-label={hasUnread ? `${unreadCount} notificações não lidas` : 'Notificações'}
                        aria-expanded={showNotifications}
                        onClick={() => setShowNotifications((v) => !v)}
                    >
                        <Bell size={18} fill={hasUnread ? 'currentColor' : 'none'} />
                        {hasUnread && (
                            <span className="header-notifications-badge" aria-hidden>
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    <NotificationDropdown
                        anchorRef={bellRef}
                        open={showNotifications}
                        onClose={() => setShowNotifications(false)}
                        notifications={notifications}
                        loading={notificationsLoading}
                        unreadCount={unreadCount}
                        onMarkAllRead={markAllRead}
                        onItemClick={handleNotificationItemClick}
                        onAccept={handleAcceptNotification}
                        onDecline={handleDeclineNotification}
                    />
                </div>

                <div className="header-user" ref={profileRef}>
                    <button className="header-user-btn" onClick={() => setShowProfile(!showProfile)}>
                        <div className="header-avatar">
                            {user?.photo_url ? (
                                <img src={user.photo_url} alt={user.name} className="header-avatar-img" />
                            ) : (
                                user?.avatar || firstName[0]
                            )}
                        </div>
                        <div className="header-user-info">
                            <span className="header-greeting-name">{firstName}</span>
                        </div>
                        <ChevronDown size={14} className={`header-chevron ${showProfile ? 'rotated' : ''}`} />
                    </button>

                    {showProfile && (
                        <div className="header-profile-dropdown animate-pop-in" data-profile-menu-dropdown>
                            <div className="header-profile-header">
                                <div className="header-profile-avatar">
                                    {user?.photo_url ? (
                                        <img src={user.photo_url} alt={user.name} className="header-avatar-img" />
                                    ) : (
                                        user?.avatar || firstName[0]
                                    )}
                                </div>
                                <div className="header-profile-text">
                                    <div className="header-profile-name">{user?.name}</div>
                                    <div className="header-profile-email">{user?.email}</div>
                                </div>
                            </div>
                            <div className="header-profile-divider" />
                            <button className="header-profile-item" onClick={() => { onOpenSettings?.(); setShowProfile(false); }}>
                                <Settings size={16} />
                                <span>Configurações</span>
                            </button>
                            <button className="header-profile-item" onClick={() => { onOpenSettings?.(); setShowProfile(false); }}>
                                <User size={16} />
                                <span>Minha Conta</span>
                            </button>
                            {activeBoard && (
                                <button
                                    className="header-profile-item"
                                    onClick={() => {
                                        const next = !showBoardToolbar;
                                        dispatch({ type: 'TOGGLE_BOARD_TOOLBAR', payload: next });
                                        if (activeBoard.id) {
                                            if (next) localStorage.removeItem(`dailyways_board_toolbar_dismissed_${activeBoard.id}`);
                                            else localStorage.setItem(`dailyways_board_toolbar_dismissed_${activeBoard.id}`, '1');
                                        }
                                    }}
                                >
                                    <Layout size={16} />
                                    <span>{showBoardToolbar ? 'Ocultar Toolbar' : 'Mostrar Toolbar'}</span>
                                </button>
                            )}
                            <div className="header-profile-divider" />
                            <button className="header-profile-item header-profile-logout" onClick={handleLogout}>
                                <LogOut size={16} />
                                <span>Sair</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {showShareModal && activeBoard && (
                <BoardDetailsModal
                    board={activeBoard}
                    onClose={() => setShowShareModal(false)}
                    initialTab="share"
                />
            )}
        </header>
    );
}
