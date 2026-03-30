import { useState, useRef, useEffect } from 'react';
import { Search, Menu, X, Bell, Settings, User, LogOut, ChevronDown, Layout, Share2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../context/ThemeContext';
import NotificationDropdown from '../Notifications/NotificationDropdown';
import BoardDetailsModal from '../Sidebar/BoardDetailsModal';
import './Header.css';
import { fetchMyInvitations } from '../../services/boardService';

export default function Header({ title, subtitle, onMenuClick, sidebarOpen, onOpenSettings, onOpenSearch, editableBoardTitle, editableSpaceTitle, variant = 'default' }) {
    const { user, logout } = useAuth();
    const { getActiveBoard, showBoardToolbar, dispatch, showConfirm } = useApp();
    const t = useI18n();
    const [showProfile, setShowProfile] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadInvitesCount, setUnreadInvitesCount] = useState(0);
    const [showShareModal, setShowShareModal] = useState(false);
    const [editingBoardTitle, setEditingBoardTitle] = useState(false);
    const [editBoardTitleValue, setEditBoardTitleValue] = useState('');
    const profileRef = useRef(null);

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

    // Close profile dropdown on click outside
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
        const loadUnread = async () => {
            if (!user?.id) {
                setUnreadInvitesCount(0);
                return;
            }
            const readKey = `dailyways_invite_read_${user.id}`;
            try {
                const raw = window.localStorage.getItem(readKey);
                const arr = raw ? JSON.parse(raw) : [];
                const readSet = new Set(Array.isArray(arr) ? arr : []);
                const { data, error } = await fetchMyInvitations();
                if (error) {
                    setUnreadInvitesCount(0);
                    return;
                }
                const unread = (data || []).filter(inv => !readSet.has(inv.id)).length;
                setUnreadInvitesCount(unread);
            } catch (_) {
                setUnreadInvitesCount(0);
            }
        };
        if (!showNotifications) {
            loadUnread();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, showNotifications]);

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
                <div className="header-icons">
                    <button
                        className="btn-icon header-icon-btn"
                        title="Notificações"
                        onClick={() => setShowNotifications(!showNotifications)}
                    >
                        <Bell size={18} />
                    </button>
                    {unreadInvitesCount > 0 && (
                        <div
                            className="header-notification-dot"
                            style={{ right: 12 }}
                            role="button"
                            tabIndex={0}
                            aria-label={`${unreadInvitesCount} convite(s) pendente(s)`}
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setShowNotifications(v => !v);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setShowNotifications(v => !v);
                                }
                            }}
                        />
                    )}
                    {showNotifications && (
                        <NotificationDropdown
                            onClose={() => setShowNotifications(false)}
                            onOpenInvitations={() => {
                                setShowNotifications(false);
                                onOpenSettings?.('invitations');
                            }}
                        />
                    )}
                </div>

                {/* User profile dropdown */}
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
                        <div className="header-profile-dropdown animate-pop-in">
                            <div className="header-profile-header">
                                <div className="header-profile-avatar">
                                    {user?.photo_url ? (
                                        <img src={user.photo_url} alt={user.name} className="header-avatar-img" />
                                    ) : (
                                        user?.avatar || firstName[0]
                                    )}
                                </div>
                                <div>
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
                                <button className="header-profile-item" onClick={() => dispatch({ type: 'TOGGLE_BOARD_TOOLBAR' })}>
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
