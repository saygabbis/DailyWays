import { useState, useRef, useEffect } from 'react';
import { Search, Menu, X, Bell, Settings, Users, LogOut, ChevronDown, Layout, Share2, MessageCircle, Undo2, Redo2 } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useApp } from '../../context/useApp';
import { useNotifications } from '../../hooks/useNotifications';
import { useBoardUndo } from '../../hooks/useBoardUndo';
import { acceptInvitation, declineInvitation } from '../../services/boardSharingService';
import { respondToContactRequest } from '../../services/contactsService';
import NotificationDropdown from '../Notifications/NotificationDropdown';
import BoardDetailsModal from '../Board/BoardDetailsModal';
import SpaceDetailsModal from '../Spaces/SpaceDetailsModal';
import CloudSyncIndicator from './CloudSyncIndicator';
import './Header.css';

/** Desfazer/refazer do board aberto (antes era um botão flutuante no canto da tela). */
function HeaderBoardHistory({ boardId }) {
    const { undo, redo, canUndo, canRedo } = useBoardUndo(boardId);
    return (
        <div className="hd-group" role="group" aria-label="Desfazer e refazer">
            <button type="button" className="hd-icon" disabled={!canUndo} onClick={() => undo()} title="Desfazer (Ctrl+Z)" aria-label="Desfazer">
                <Undo2 size={18} />
            </button>
            <button type="button" className="hd-icon" disabled={!canRedo} onClick={() => redo()} title="Refazer (Ctrl+Y)" aria-label="Refazer">
                <Redo2 size={18} />
            </button>
        </div>
    );
}

function badgeText(n) {
    return n > 9 ? '9+' : String(n);
}

export default function Header({ title, subtitle, onMenuClick, sidebarOpen, onOpenSettings, onOpenSearch, editableBoardTitle, editableSpaceTitle, variant = 'default' }) {
    const { user, logout } = useAuth();
    const { getActiveBoard, showBoardToolbar, dispatch, showConfirm, reloadBoards } = useApp();
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
    const [chatUnread, setChatUnread] = useState(0);
    const profileRef = useRef(null);
    const bellRef = useRef(null);
    const notificationsRef = useRef(null);

    const activeBoard = getActiveBoard();
    const activeSpace = editableSpaceTitle?.space ?? null;

    const editableTitle = editableBoardTitle || editableSpaceTitle;
    const currentEditableValue = editableBoardTitle?.board?.title ?? editableSpaceTitle?.space?.title ?? '';
    const titleEmoji = editableBoardTitle?.board?.emoji || editableSpaceTitle?.space?.emoji || null;

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
    const avatar = user?.photo_url
        ? <img src={user.photo_url} alt="" className="header-avatar-img" />
        : (user?.avatar || firstName[0]);

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
        const onUnread = (e) => setChatUnread(Number(e.detail?.count) || 0);
        window.addEventListener('app-chat-unread', onUnread);
        return () => window.removeEventListener('app-chat-unread', onUnread);
    }, []);

    useEffect(() => {
        if (!showProfile) return;
        const handleClick = (e) => {
            if (profileRef.current && !profileRef.current.contains(e.target)) {
                setShowProfile(false);
            }
        };
        const handleKey = (e) => { if (e.key === 'Escape') setShowProfile(false); };
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKey);
        };
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
                <button
                    type="button"
                    className="hd-icon header-menu"
                    onClick={onMenuClick}
                    aria-label={sidebarOpen ? 'Fechar navegação' : 'Abrir navegação'}
                    aria-expanded={!!sidebarOpen}
                >
                    {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
                <div className="header-title-group">
                    {titleEmoji && <span className="header-title-emoji" aria-hidden>{titleEmoji}</span>}
                    <div className="header-title-text">
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
                                    maxLength={120}
                                    aria-label="Nome"
                                />
                            </form>
                        ) : editableTitle ? (
                            <h1 className="header-title">
                                <button type="button" className="header-title-editable" onClick={handleStartEditBoardTitle} title="Renomear">
                                    {title}
                                </button>
                            </h1>
                        ) : (
                            <h1 className="header-title">{title}</h1>
                        )}
                        {subtitle && <span className="header-subtitle">{subtitle}</span>}
                    </div>
                </div>
            </div>

            <div className="header-right">
                <CloudSyncIndicator />

                {editableBoardTitle?.board?.id && <HeaderBoardHistory boardId={editableBoardTitle.board.id} />}

                <button type="button" className="hd-search" onClick={onOpenSearch} aria-label="Buscar" title="Buscar (Ctrl+K)">
                    <Search size={17} />
                    <span className="hd-search-label">Buscar</span>
                    <kbd className="hd-kbd">Ctrl K</kbd>
                </button>

                {editableTitle && (
                    <button type="button" className="hd-icon hd-share" title="Compartilhar" aria-label="Compartilhar" onClick={() => setShowShareModal(true)}>
                        <Share2 size={18} />
                    </button>
                )}

                <button
                    type="button"
                    className="hd-icon"
                    title="Conversas"
                    aria-label={chatUnread ? `Conversas — ${chatUnread} não lidas` : 'Conversas'}
                    onClick={() => window.dispatchEvent(new CustomEvent('app-chat-open', { detail: { toggle: true } }))}
                >
                    <MessageCircle size={18} />
                    {chatUnread > 0 && <span className="hd-badge" aria-hidden>{badgeText(chatUnread)}</span>}
                </button>

                <div className="header-notifications" ref={notificationsRef}>
                    <button
                        ref={bellRef}
                        type="button"
                        className={`hd-icon ${hasUnread ? 'has-unread' : ''}`}
                        title="Notificações"
                        aria-label={hasUnread ? `${unreadCount} notificações não lidas` : 'Notificações'}
                        aria-expanded={showNotifications}
                        onClick={() => setShowNotifications((v) => !v)}
                    >
                        <Bell size={18} />
                        {hasUnread && <span className="hd-badge" aria-hidden>{badgeText(unreadCount)}</span>}
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
                    <button
                        type="button"
                        className="header-user-btn"
                        onClick={() => setShowProfile(!showProfile)}
                        aria-haspopup="menu"
                        aria-expanded={showProfile}
                        aria-label={`Conta de ${firstName}`}
                    >
                        <span className="header-avatar">{avatar}</span>
                        <span className="header-greeting-name">{firstName}</span>
                        <ChevronDown size={14} className={`header-chevron ${showProfile ? 'rotated' : ''}`} aria-hidden />
                    </button>

                    {showProfile && (
                        <div className="header-profile-dropdown" role="menu" data-profile-menu-dropdown>
                            <div className="header-profile-header">
                                <span className="header-profile-avatar">{avatar}</span>
                                <div className="header-profile-text">
                                    <div className="header-profile-name">{user?.name}</div>
                                    <div className="header-profile-email">{user?.email}</div>
                                </div>
                            </div>
                            <div className="header-profile-divider" />
                            <button
                                type="button"
                                role="menuitem"
                                className="header-profile-item"
                                onClick={() => {
                                    setShowProfile(false);
                                    window.dispatchEvent(new CustomEvent('app-navigate-view', { detail: { view: 'contacts' } }));
                                }}
                            >
                                <Users size={16} />
                                <span>Meus contatos</span>
                            </button>
                            {editableTitle && (
                                <button type="button" role="menuitem" className="header-profile-item header-profile-item--compact-only" onClick={() => { setShowProfile(false); setShowShareModal(true); }}>
                                    <Share2 size={16} />
                                    <span>Compartilhar</span>
                                </button>
                            )}
                            <button type="button" role="menuitem" className="header-profile-item" onClick={() => { onOpenSettings?.(); setShowProfile(false); }}>
                                <Settings size={16} />
                                <span>Configurações</span>
                            </button>
                            {activeBoard && variant === 'workspace' && !activeSpace && (
                                <button
                                    type="button"
                                    role="menuitem"
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
                                    <span>{showBoardToolbar ? 'Ocultar barra do board' : 'Mostrar barra do board'}</span>
                                </button>
                            )}
                            <div className="header-profile-divider" />
                            <button type="button" role="menuitem" className="header-profile-item header-profile-logout" onClick={handleLogout}>
                                <LogOut size={16} />
                                <span>Sair</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {showShareModal && activeSpace && (
                <SpaceDetailsModal
                    space={activeSpace}
                    onClose={() => setShowShareModal(false)}
                    initialTab="share"
                />
            )}
            {showShareModal && !activeSpace && activeBoard && (
                <BoardDetailsModal
                    board={activeBoard}
                    onClose={() => setShowShareModal(false)}
                    initialTab="share"
                />
            )}
        </header>
    );
}
