import { useState, useRef, useEffect } from 'react';
import { Search, Menu, X, Bell, Settings, User, LogOut, ChevronDown, Layout } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../context/ThemeContext';
import NotificationDropdown from '../Notifications/NotificationDropdown';
import './Header.css';

export default function Header({ title, subtitle, onMenuClick, sidebarOpen, onOpenSettings, onOpenSearch }) {
    const { user, logout } = useAuth();
    const { getActiveBoard, showBoardToolbar, dispatch, showConfirm } = useApp();
    const t = useI18n();
    const [showProfile, setShowProfile] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const profileRef = useRef(null);

    const activeBoard = getActiveBoard();

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

    return (
        <header className="header">
            <div className="header-left">
                <button className="btn-icon header-menu" onClick={onMenuClick} aria-label="Menu">
                    {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
                </button>
                <div className="header-title-group">
                    <h1 className="header-title">{title}</h1>
                    {subtitle && <span className="header-subtitle">{subtitle}</span>}
                </div>
            </div>

            <div className="header-right">
                <button className="header-search-btn" onClick={onOpenSearch}>
                    <Search size={18} />
                    <span>{t.search}</span>
                    <kbd className="header-search-kbd">Ctrl+K</kbd>
                </button>

                <div className="header-icons">
                    <button
                        className="btn-icon header-icon-btn"
                        title="Notificações"
                        onClick={() => setShowNotifications(!showNotifications)}
                    >
                        <Bell size={18} />
                        <span className="header-notification-dot" />
                    </button>
                    {showNotifications && <NotificationDropdown onClose={() => setShowNotifications(false)} />}
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
        </header>
    );
}
