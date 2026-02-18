import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
    User, Palette, Globe, Smartphone, Sun, Moon,
    ChevronRight, Save, Shield, Bell, LogOut,
    X, ZoomIn, ZoomOut, Sparkles, ShieldCheck, Link2, Unlink
} from 'lucide-react';
import { Chrome, Command, Github } from 'lucide-react';
import { ENABLE_MICROSOFT_LOGIN } from '../../config';
import './Settings.css';

const PROVIDERS = [
    { id: 'google', label: 'Google', icon: Chrome },
    { id: 'github', label: 'GitHub', icon: Github },
    ...(ENABLE_MICROSOFT_LOGIN ? [{ id: 'microsoft', label: 'Microsoft', icon: Command }] : []),
];

export default function SettingsModal({ onClose }) {
    const {
        user,
        updateProfile,
        logout,
        confirmLogout,
        startMfaEnrollment,
        verifyMfaEnrollment,
        disableMfa,
        getLinkedIdentities,
        linkIdentity,
        unlinkIdentity,
        setPassword,
    } = useAuth();
    const { theme, toggleTheme, accentId, setAccent, ACCENT_PRESETS } = useTheme();

    const [activeTab, setActiveTab] = useState('account');
    const [name, setName] = useState(user?.name || '');
    const [username, setUsername] = useState(user?.username || '');
    const [avatar, setAvatar] = useState(user?.avatar || '');
    const [bio, setBio] = useState(user?.bio || '');
    const [saved, setSaved] = useState(false);
    const [saveError, setSaveError] = useState('');

    const [mfaFactors, setMfaFactors] = useState([]);
    const [mfaEnrolling, setMfaEnrolling] = useState(false);
    const [mfaQrCode, setMfaQrCode] = useState(null);
    const [mfaFactorId, setMfaFactorId] = useState(null);
    const [mfaVerifyCode, setMfaVerifyCode] = useState('');
    const [mfaError, setMfaError] = useState('');
    const [identities, setIdentities] = useState([]);
    const [identitiesLoading, setIdentitiesLoading] = useState(false);
    const [linkError, setLinkError] = useState('');
    const [passwordCurrent, setPasswordCurrent] = useState('');
    const [passwordNew, setPasswordNew] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState(false);

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
        { id: 'security', label: 'Segurança', icon: Shield },
        { id: 'appearance', label: 'Aparência', icon: Palette },
        { id: 'app', label: 'Aplicativo', icon: Smartphone },
        { id: 'language', label: 'Idioma', icon: Globe },
    ];

    useEffect(() => {
        setName(user?.name || '');
        setUsername(user?.username || '');
        setAvatar(user?.avatar || '');
        setBio(user?.bio || '');
    }, [user]);

    useEffect(() => {
        if (activeTab === 'security' && user) {
            setIdentitiesLoading(true);
            setLinkError('');
            getLinkedIdentities().then(({ identities: ids }) => {
                setIdentities(ids || []);
                setIdentitiesLoading(false);
            });
            import('../../services/supabaseClient').then(({ supabase }) => {
                supabase.auth.mfa.listFactors().then(({ data }) => {
                    setMfaFactors(data?.totp ?? []);
                });
            });
        }
    }, [activeTab, user, getLinkedIdentities]);

    const handleSaveProfile = async () => {
        setSaveError('');
        const result = await updateProfile({ name, username, avatar, bio });
        if (result?.success) {
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } else {
            setSaveError(result?.error || 'Erro ao salvar.');
        }
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
                                            {user?.username && <p className="settings-username">@{user.username}</p>}
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
                                        <label>Username</label>
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                                            placeholder="username"
                                        />
                                    </div>

                                    <div className="settings-field">
                                        <label>E-mail</label>
                                        <input
                                            type="email"
                                            value={user?.email ?? ''}
                                            readOnly
                                            disabled
                                            placeholder="seu@email.com"
                                            className="settings-input-readonly"
                                        />
                                        <p className="settings-field-hint">Alterar e-mail requer confirmação na conta do provedor.</p>
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

                                    {saveError && <p className="settings-error">{saveError}</p>}
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
                                        <button className="btn btn-danger btn-sm" onClick={confirmLogout}>
                                            <LogOut size={14} />
                                            Sair
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ═══ SECURITY ═══ */}
                        {activeTab === 'security' && (
                            <div className="settings-panel animate-fade-in">
                                <div className="settings-panel-header">
                                    <h2>Segurança</h2>
                                    <p>Verificação em duas etapas e contas vinculadas</p>
                                </div>

                                <div className="settings-section">
                                    <h3 className="settings-section-title">E-mail e login</h3>
                                    <div className="settings-status-badges">
                                        {(() => {
                                            const hasEmailIdentity = identities.some(i => i.provider === 'email');
                                            const hasPassword = hasEmailIdentity || user?.has_password;
                                            const verified = user?.email_confirmed_at && hasEmailIdentity;
                                            return (
                                                <>
                                                    {verified && (
                                                        <span className="settings-badge settings-badge-success">
                                                            <ShieldCheck size={14} /> E-mail verificado
                                                        </span>
                                                    )}
                                                    {hasPassword && (
                                                        <span className="settings-badge settings-badge-success">
                                                            <ShieldCheck size={14} /> Senha vinculada
                                                        </span>
                                                    )}
                                                    {!hasPassword && identities.length > 0 && (
                                                        <span className="settings-badge settings-badge-neutral">
                                                            Defina uma senha abaixo para entrar também com e-mail e senha.
                                                        </span>
                                                    )}
                                                    {identities.length === 0 && !user?.email_confirmed_at && (
                                                        <span className="settings-badge settings-badge-warning">Não verificado</span>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>

                                <div className="settings-section">
                                    <h3 className="settings-section-title">Senha</h3>
                                    {!(identities.some(i => i.provider === 'email') || user?.has_password) ? (
                                        <>
                                            <p className="settings-section-desc">
                                                Defina uma senha para poder entrar com e-mail e senha.
                                            </p>
                                            {passwordSuccess && <p className="settings-success">Senha definida. Agora você pode entrar com e-mail e senha.</p>}
                                            {passwordError && <p className="settings-error">{passwordError}</p>}
                                            <div className="settings-field">
                                                <label>Nova senha</label>
                                                <input
                                                    type="password"
                                                    value={passwordNew}
                                                    onChange={e => { setPasswordNew(e.target.value); setPasswordError(''); }}
                                                    placeholder="Mínimo 6 caracteres"
                                                    minLength={6}
                                                    autoComplete="new-password"
                                                />
                                            </div>
                                            <div className="settings-field">
                                                <label>Confirmar senha</label>
                                                <input
                                                    type="password"
                                                    value={passwordConfirm}
                                                    onChange={e => { setPasswordConfirm(e.target.value); setPasswordError(''); }}
                                                    placeholder="Repita a senha"
                                                    autoComplete="new-password"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                className="btn btn-primary btn-sm"
                                                disabled={!passwordNew || passwordNew !== passwordConfirm || passwordNew.length < 6}
                                                onClick={async () => {
                                                    setPasswordError('');
                                                    setPasswordSuccess(false);
                                                    if (passwordNew !== passwordConfirm) {
                                                        setPasswordError('As senhas não coincidem.');
                                                        return;
                                                    }
                                                    const result = await setPassword(passwordNew);
                                                    if (result.success) {
                                                        setPasswordSuccess(true);
                                                        setPasswordNew('');
                                                        setPasswordConfirm('');
                                                        const { identities: ids } = await getLinkedIdentities();
                                                        setIdentities(ids || []);
                                                    } else {
                                                        setPasswordError(result.error || 'Erro ao definir senha.');
                                                    }
                                                }}
                                            >
                                                Definir senha
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            {passwordSuccess && <p className="settings-success">Senha alterada com sucesso.</p>}
                                            {passwordError && <p className="settings-error">{passwordError}</p>}
                                            <div className="settings-field">
                                                <label>Senha atual</label>
                                                <input
                                                    type="password"
                                                    value={passwordCurrent}
                                                    onChange={e => { setPasswordCurrent(e.target.value); setPasswordError(''); }}
                                                    placeholder="Sua senha atual"
                                                    autoComplete="current-password"
                                                />
                                            </div>
                                            <div className="settings-field">
                                                <label>Nova senha</label>
                                                <input
                                                    type="password"
                                                    value={passwordNew}
                                                    onChange={e => { setPasswordNew(e.target.value); setPasswordError(''); }}
                                                    placeholder="Mínimo 6 caracteres"
                                                    minLength={6}
                                                    autoComplete="new-password"
                                                />
                                            </div>
                                            <div className="settings-field">
                                                <label>Confirmar nova senha</label>
                                                <input
                                                    type="password"
                                                    value={passwordConfirm}
                                                    onChange={e => { setPasswordConfirm(e.target.value); setPasswordError(''); }}
                                                    placeholder="Repita a nova senha"
                                                    autoComplete="new-password"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                className="btn btn-primary btn-sm"
                                                disabled={!passwordCurrent || !passwordNew || passwordNew !== passwordConfirm || passwordNew.length < 6}
                                                onClick={async () => {
                                                    setPasswordError('');
                                                    setPasswordSuccess(false);
                                                    if (passwordNew !== passwordConfirm) {
                                                        setPasswordError('As senhas não coincidem.');
                                                        return;
                                                    }
                                                    const { supabase } = await import('../../services/supabaseClient');
                                                    const { error: signInError } = await supabase.auth.signInWithPassword({
                                                        email: user?.email,
                                                        password: passwordCurrent,
                                                    });
                                                    if (signInError) {
                                                        setPasswordError('Senha atual incorreta.');
                                                        return;
                                                    }
                                                    const result = await setPassword(passwordNew);
                                                    if (result.success) {
                                                        setPasswordSuccess(true);
                                                        setPasswordCurrent('');
                                                        setPasswordNew('');
                                                        setPasswordConfirm('');
                                                    } else {
                                                        setPasswordError(result.error || 'Erro ao alterar senha.');
                                                    }
                                                }}
                                            >
                                                Alterar senha
                                            </button>
                                        </>
                                    )}
                                </div>

                                <div className="settings-section">
                                    <h3 className="settings-section-title">Verificação em duas etapas (2FA)</h3>
                                    {mfaFactors.some(f => f.status === 'verified') ? (
                                        <div className="settings-mfa-status">
                                            <span className="settings-badge settings-badge-success">
                                                <ShieldCheck size={14} /> 2FA ativo
                                            </span>
                                            <button
                                                type="button"
                                                className="btn btn-danger btn-sm"
                                                onClick={async () => {
                                                    if (!window.confirm('Desativar verificação em duas etapas?')) return;
                                                    const result = await disableMfa();
                                                    if (result.success) {
                                                        setMfaFactors([]);
                                                    } else {
                                                        setMfaError(result.error);
                                                    }
                                                }}
                                            >
                                                Desativar 2FA
                                            </button>
                                        </div>
                                    ) : mfaQrCode ? (
                                        <div className="settings-mfa-enroll">
                                            <p>Escaneie o QR code com seu app autenticador (Google Authenticator, Authy, etc.):</p>
                                            <div className="settings-mfa-qr">
                                                <img src={mfaQrCode} alt="QR Code 2FA" width={180} height={180} />
                                            </div>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                placeholder="Código de 6 dígitos"
                                                value={mfaVerifyCode}
                                                onChange={e => setMfaVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                className="settings-mfa-code-input"
                                            />
                                            {mfaError && <p className="settings-error">{mfaError}</p>}
                                            <div className="settings-actions">
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    disabled={mfaVerifyCode.length !== 6}
                                                    onClick={async () => {
                                                        const result = await verifyMfaEnrollment(mfaFactorId, mfaVerifyCode);
                                                        if (result.success) {
                                                            setMfaQrCode(null);
                                                            setMfaFactorId(null);
                                                            setMfaVerifyCode('');
                                                            setMfaError('');
                                                            setMfaEnrolling(false);
                                                            const { supabase } = await import('../../services/supabaseClient');
                                                            const { data } = await supabase.auth.mfa.listFactors();
                                                            setMfaFactors(data?.totp ?? []);
                                                        } else {
                                                            setMfaError(result.error);
                                                        }
                                                    }}
                                                >
                                                    Confirmar e ativar 2FA
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => {
                                                        setMfaQrCode(null);
                                                        setMfaFactorId(null);
                                                        setMfaEnrolling(false);
                                                        setMfaError('');
                                                    }}
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <p className="settings-section-desc">Proteja sua conta com um código gerado no celular.</p>
                                            {mfaError && <p className="settings-error">{mfaError}</p>}
                                            <button
                                                type="button"
                                                className="btn btn-primary btn-sm"
                                                disabled={mfaEnrolling}
                                                onClick={async () => {
                                                    setMfaError('');
                                                    setMfaEnrolling(true);
                                                    const result = await startMfaEnrollment();
                                                    setMfaEnrolling(false);
                                                    if (result.success && result.data) {
                                                        setMfaQrCode(result.data.qrCode);
                                                        setMfaFactorId(result.data.id);
                                                    } else {
                                                        setMfaError(result.error || 'Erro ao ativar 2FA');
                                                    }
                                                }}
                                            >
                                                {mfaEnrolling ? 'Abrindo...' : 'Ativar 2FA'}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="settings-section">
                                    <h3 className="settings-section-title">Contas vinculadas</h3>
                                    <p className="settings-section-desc">Vincule Google, GitHub ou Microsoft para entrar com um clique.</p>
                                    {identitiesLoading && <p className="settings-muted">Carregando...</p>}
                                    {linkError && <p className="settings-error">{linkError}</p>}
                                    <div className="settings-identities">
                                        {PROVIDERS.map(({ id, label, icon: Icon }) => {
                                            const linked = identities.find(i => i.provider === (id === 'microsoft' ? 'azure' : id));
                                            return (
                                                <div key={id} className="settings-identity-row">
                                                    <Icon size={20} />
                                                    <span>{label}</span>
                                                    <span className="settings-identity-status">
                                                        {linked ? `Vinculado (${linked.identity_data?.email ?? linked.email ?? '—'})` : 'Não vinculado'}
                                                    </span>
                                                    {linked ? (
                                                        <button
                                                            type="button"
                                                            className="btn btn-ghost btn-sm"
                                                            onClick={async () => {
                                                                const result = await unlinkIdentity(linked);
                                                                if (result.success) {
                                                                    const { identities: ids } = await getLinkedIdentities();
                                                                    setIdentities(ids || []);
                                                                    setLinkError('');
                                                                } else {
                                                                    setLinkError(result.error || 'Não foi possível desvincular.');
                                                                }
                                                            }}
                                                        >
                                                            <Unlink size={14} /> Desvincular
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            className="btn btn-primary btn-sm"
                                                            onClick={async () => {
                                                                setLinkError('');
                                                                const result = await linkIdentity(id);
                                                                if (!result.success && result.error) {
                                                                    const msg = result.error.toLowerCase().includes('manual linking') || result.error.includes('linking is disabled')
                                                                        ? 'Vinculação manual está desativada no Supabase. Ative em Authentication > Providers > Identity linking (ou Auth Settings). Veja SUPABASE_SETUP.md.'
                                                                        : result.error;
                                                                    setLinkError(msg);
                                                                }
                                                            }}
                                                        >
                                                            <Link2 size={14} /> Vincular
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
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
                                        <span className="settings-info-value">Supabase (PostgreSQL)</span>
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
