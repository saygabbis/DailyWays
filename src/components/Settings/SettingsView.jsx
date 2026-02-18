import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
    User, Palette, Globe, Smartphone, Sun, Moon,
    ChevronRight, Save, Camera, Shield, Bell, LogOut,
    X, ZoomIn, ZoomOut, Sparkles
} from 'lucide-react';
import './Settings.css';

export default function SettingsModal({ onClose }) {
    const { user, updateProfile, logout } = useAuth();
    const { theme, toggleTheme, accentId, setAccent, ACCENT_PRESETS } = useTheme();

    const [activeTab, setActiveTab] = useState('account');
    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [avatar, setAvatar] = useState(user?.avatar || '');
    const [bio, setBio] = useState(user?.bio || '');
    const [saved, setSaved] = useState(false);

    // Zoom level
    const [zoom, setZoom] = useState(() => {
        const stored = localStorage.getItem('dailyways_zoom');
        return stored ? parseInt(stored) : 100;
    });

    // App settings
    const [notifications, setNotifications] = useState(true);
    const [sounds, setSounds] = useState(true);
    const [autoSave, setAutoSave] = useState(true);

    // Language
    const [language, setLanguage] = useState('pt-br');

    const tabs = [
        { id: 'account', label: 'Conta', icon: User },
        { id: 'appearance', label: 'Aparência', icon: Palette },
        { id: 'app', label: 'Aplicativo', icon: Smartphone },
        { id: 'language', label: 'Idioma', icon: Globe },
    ];

    const handleSaveProfile = () => {
        updateProfile({ name, email, avatar, bio });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleClearData = () => {
        if (window.confirm('Tem certeza que deseja limpar todos os dados? Esta ação é irreversível.')) {
            localStorage.clear();
            window.location.reload();
        }
    };

    const handleZoom = (value) => {
        const clamped = Math.min(150, Math.max(75, value));
        setZoom(clamped);
        localStorage.setItem('dailyways_zoom', clamped);
        document.documentElement.style.fontSize = `${clamped}%`;
    };

    const languages = [
        { id: 'pt-br', label: 'Português (Brasil)', flag: '🇧🇷' },
        { id: 'en', label: 'English', flag: '🇺🇸' },
        { id: 'es', label: 'Español', flag: '🇪🇸' },
        { id: 'fr', label: 'Français', flag: '🇫🇷' },
        { id: 'de', label: 'Deutsch', flag: '🇩🇪' },
        { id: 'ja', label: '日本語', flag: '🇯🇵' },
    ];

    // Close on Escape
    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="settings-modal animate-scale-in">
                {/* Close button */}
                <button className="settings-modal-close btn-icon" onClick={onClose}>
                    <X size={20} />
                </button>

                <div className="settings-container">
                    {/* Tabs Sidebar */}
                    <div className="settings-tabs">
                        <div className="settings-tabs-title">
                            <Sparkles size={18} />
                            Configurações
                        </div>
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                className={`settings-tab ${activeTab === tab.id ? 'settings-tab-active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                <tab.icon size={18} />
                                <span>{tab.label}</span>
                                <ChevronRight size={14} className="settings-tab-arrow" />
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="settings-content">
                        {/* ═══ ACCOUNT ═══ */}
                        {activeTab === 'account' && (
                            <div className="settings-panel animate-fade-in">
                                <div className="settings-panel-header">
                                    <h2>Conta</h2>
                                    <p>Gerencie suas informações pessoais</p>
                                </div>

                                <div className="settings-section">
                                    <div className="settings-avatar-section">
                                        <div className="settings-avatar-large">
                                            {avatar || name?.[0] || '?'}
                                        </div>
                                        <div className="settings-avatar-info">
                                            <h3>{user?.name}</h3>
                                            <p>{user?.email}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="settings-section">
                                    <h3 className="settings-section-title">Informações Pessoais</h3>

                                    <div className="settings-field">
                                        <label>Nome</label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            placeholder="Seu nome"
                                        />
                                    </div>

                                    <div className="settings-field">
                                        <label>E-mail</label>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            placeholder="seu@email.com"
                                        />
                                    </div>

                                    <div className="settings-field">
                                        <label>Bio</label>
                                        <textarea
                                            value={bio}
                                            onChange={e => setBio(e.target.value)}
                                            placeholder="Conte um pouco sobre você..."
                                            rows={2}
                                            className="settings-bio"
                                        />
                                    </div>

                                    <div className="settings-field">
                                        <label>Avatar (emoji)</label>
                                        <input
                                            type="text"
                                            value={avatar}
                                            onChange={e => setAvatar(e.target.value)}
                                            placeholder="😊"
                                            maxLength={2}
                                        />
                                    </div>

                                    <div className="settings-actions">
                                        <button className="btn btn-primary" onClick={handleSaveProfile}>
                                            <Save size={16} />
                                            {saved ? 'Salvo! ✓' : 'Salvar Alterações'}
                                        </button>
                                    </div>
                                </div>

                                <div className="settings-section settings-danger-zone">
                                    <h3 className="settings-section-title">Zona de Perigo</h3>
                                    <div className="settings-danger-card">
                                        <div>
                                            <strong>Limpar todos os dados</strong>
                                            <p>Remove todos os boards, tarefas e configurações</p>
                                        </div>
                                        <button className="btn btn-danger btn-sm" onClick={handleClearData}>
                                            Limpar
                                        </button>
                                    </div>
                                    <div className="settings-danger-card">
                                        <div>
                                            <strong>Sair da conta</strong>
                                            <p>Encerrar a sessão atual</p>
                                        </div>
                                        <button className="btn btn-danger btn-sm" onClick={logout}>
                                            <LogOut size={14} />
                                            Sair
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ═══ APPEARANCE ═══ */}
                        {activeTab === 'appearance' && (
                            <div className="settings-panel animate-fade-in">
                                <div className="settings-panel-header">
                                    <h2>Aparência</h2>
                                    <p>Personalize o visual do seu DailyWays</p>
                                </div>

                                {/* Theme */}
                                <div className="settings-section">
                                    <h3 className="settings-section-title">Tema</h3>
                                    <div className="settings-theme-grid">
                                        <button
                                            className={`settings-theme-card ${theme === 'light' ? 'active' : ''}`}
                                            onClick={() => { if (theme !== 'light') toggleTheme(); }}
                                        >
                                            <div className="settings-theme-preview settings-theme-light">
                                                <div className="stp-sidebar" />
                                                <div className="stp-content">
                                                    <div className="stp-header" />
                                                    <div className="stp-cards">
                                                        <div className="stp-card" />
                                                        <div className="stp-card" />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="settings-theme-label">
                                                <Sun size={16} />
                                                <span>Claro</span>
                                            </div>
                                        </button>

                                        <button
                                            className={`settings-theme-card ${theme === 'dark' ? 'active' : ''}`}
                                            onClick={() => { if (theme !== 'dark') toggleTheme(); }}
                                        >
                                            <div className="settings-theme-preview settings-theme-dark">
                                                <div className="stp-sidebar" />
                                                <div className="stp-content">
                                                    <div className="stp-header" />
                                                    <div className="stp-cards">
                                                        <div className="stp-card" />
                                                        <div className="stp-card" />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="settings-theme-label">
                                                <Moon size={16} />
                                                <span>Escuro</span>
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                {/* Accent Color */}
                                <div className="settings-section">
                                    <h3 className="settings-section-title">Cor de Destaque</h3>
                                    <p className="settings-section-desc">Escolha a cor principal da interface</p>
                                    <div className="settings-accent-grid">
                                        {ACCENT_PRESETS.map(preset => (
                                            <button
                                                key={preset.id}
                                                className={`settings-accent-btn ${accentId === preset.id ? 'active' : ''}`}
                                                onClick={() => setAccent(preset.id)}
                                                title={preset.name}
                                            >
                                                <span
                                                    className="settings-accent-color"
                                                    style={{ background: `linear-gradient(135deg, ${preset.color}, ${preset.secondary})` }}
                                                />
                                                <span className="settings-accent-name">{preset.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Zoom */}
                                <div className="settings-section">
                                    <h3 className="settings-section-title">Tamanho da Interface</h3>
                                    <div className="settings-zoom-control">
                                        <button className="btn-icon" onClick={() => handleZoom(zoom - 10)} disabled={zoom <= 75}>
                                            <ZoomOut size={18} />
                                        </button>
                                        <div className="settings-zoom-bar">
                                            <input
                                                type="range"
                                                min="75"
                                                max="150"
                                                step="5"
                                                value={zoom}
                                                onChange={e => handleZoom(parseInt(e.target.value))}
                                            />
                                            <span className="settings-zoom-value">{zoom}%</span>
                                        </div>
                                        <button className="btn-icon" onClick={() => handleZoom(zoom + 10)} disabled={zoom >= 150}>
                                            <ZoomIn size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ═══ APP ═══ */}
                        {activeTab === 'app' && (
                            <div className="settings-panel animate-fade-in">
                                <div className="settings-panel-header">
                                    <h2>Aplicativo</h2>
                                    <p>Configurações gerais do aplicativo</p>
                                </div>

                                <div className="settings-section">
                                    <h3 className="settings-section-title">Notificações</h3>

                                    <div className="settings-toggle-row">
                                        <div className="settings-toggle-info">
                                            <Bell size={18} />
                                            <div>
                                                <strong>Notificações Push</strong>
                                                <p>Receba alertas sobre tarefas vencendo</p>
                                            </div>
                                        </div>
                                        <button
                                            className={`settings-toggle ${notifications ? 'active' : ''}`}
                                            onClick={() => setNotifications(!notifications)}
                                        >
                                            <span className="settings-toggle-thumb" />
                                        </button>
                                    </div>

                                    <div className="settings-toggle-row">
                                        <div className="settings-toggle-info">
                                            <Smartphone size={18} />
                                            <div>
                                                <strong>Sons</strong>
                                                <p>Tocar sons ao completar tarefas</p>
                                            </div>
                                        </div>
                                        <button
                                            className={`settings-toggle ${sounds ? 'active' : ''}`}
                                            onClick={() => setSounds(!sounds)}
                                        >
                                            <span className="settings-toggle-thumb" />
                                        </button>
                                    </div>

                                    <div className="settings-toggle-row">
                                        <div className="settings-toggle-info">
                                            <Save size={18} />
                                            <div>
                                                <strong>Salvar automaticamente</strong>
                                                <p>Salvar alterações em tempo real</p>
                                            </div>
                                        </div>
                                        <button
                                            className={`settings-toggle ${autoSave ? 'active' : ''}`}
                                            onClick={() => setAutoSave(!autoSave)}
                                        >
                                            <span className="settings-toggle-thumb" />
                                        </button>
                                    </div>
                                </div>

                                <div className="settings-section">
                                    <h3 className="settings-section-title">Dados</h3>
                                    <div className="settings-info-row">
                                        <span>Versão</span>
                                        <span className="settings-info-value">2.0.0</span>
                                    </div>
                                    <div className="settings-info-row">
                                        <span>Armazenamento</span>
                                        <span className="settings-info-value">LocalStorage</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ═══ LANGUAGE ═══ */}
                        {activeTab === 'language' && (
                            <div className="settings-panel animate-fade-in">
                                <div className="settings-panel-header">
                                    <h2>Idioma</h2>
                                    <p>Escolha o idioma da interface</p>
                                </div>

                                <div className="settings-section">
                                    <div className="settings-language-grid">
                                        {languages.map(lang => (
                                            <button
                                                key={lang.id}
                                                className={`settings-language-btn ${language === lang.id ? 'active' : ''}`}
                                                onClick={() => setLanguage(lang.id)}
                                            >
                                                <span className="settings-language-flag">{lang.flag}</span>
                                                <span className="settings-language-label">{lang.label}</span>
                                                {language === lang.id && (
                                                    <span className="settings-language-check">✓</span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
