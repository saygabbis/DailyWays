import { useState, useRef, useEffect, useCallback, useMemo, memo, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { useTheme, useI18n } from '../../context/ThemeContext';
import {
    User, Palette, Globe, Smartphone, Sun, Moon,
    ChevronRight, Save, Shield, Bell, LogOut,
    X, ZoomIn, ZoomOut, ShieldCheck, Link2, Unlink, Cloud,
    ChevronLeft as ChevLeft, ChevronRight as ChevRight,
    Camera, Trash2, Users,
} from 'lucide-react';
import { Chrome, Command, Github, Plus } from 'lucide-react';
import { ENABLE_MICROSOFT_LOGIN } from '../../config';
import pkg from '../../../package.json';
import { fetchMyInvitations, acceptInvitation, declineInvitation } from '../../services/boardService';
import logoWhite from '../../assets/Logo - Branco.png';
import logoBlack from '../../assets/Logo - Preto.png';
import CustomAccentPopover from './CustomAccentPopover';
import { CUSTOM_ACCENT_ID } from '../../context/ThemeContext';
import './Settings.css';
import './AvatarCropper.css';
const AvatarCropper = lazy(() => import('./AvatarCropper'));

const PROVIDERS = [
    { id: 'google', label: 'Google', icon: Chrome },
    { id: 'github', label: 'GitHub', icon: Github },
    ...(ENABLE_MICROSOFT_LOGIN ? [{ id: 'microsoft', label: 'Microsoft', icon: Command }] : []),
];

// ─────────────────────────────────────────────
// ACCOUNT PANEL
// ─────────────────────────────────────────────
const AccountPanel = memo(function AccountPanel({ user, updateProfile, confirmLogout, uploadAvatar, removeAvatar, t }) {
    const [name, setName] = useState(user?.name || '');
    const [username, setUsername] = useState(user?.username || '');
    const [avatar, setAvatar] = useState(user?.avatar || '');
    const [bio, setBio] = useState(user?.bio || '');
    const [saved, setSaved] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [photoUrl, setPhotoUrl] = useState(user?.photo_url || null);
    const [showCropper, setShowCropper] = useState(false);
    const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
    const [photoLoading, setPhotoLoading] = useState(false);
    const avatarMenuRef = useRef(null);

    // Update from user prop changes  
    useEffect(() => {
        setName(user?.name || '');
        setUsername(user?.username || '');
        setAvatar(user?.avatar || '');
        setBio(user?.bio || '');
        setPhotoUrl(user?.photo_url || null);
    }, [user]);

    // Close avatar menu on outside click
    useEffect(() => {
        const handler = (e) => {
            if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target))
                setAvatarMenuOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleAvatarUpload = useCallback(async (blob) => {
        setPhotoLoading(true);
        setShowCropper(false);
        const result = await uploadAvatar(blob);
        if (result?.success) setPhotoUrl(result.photo_url || user?.photo_url || null);
        setPhotoLoading(false);
        setAvatarMenuOpen(false);
    }, [uploadAvatar, user?.photo_url]);

    const handleRemovePhoto = useCallback(async () => {
        setAvatarMenuOpen(false);
        setPhotoLoading(true);
        await removeAvatar();
        setPhotoUrl(null);
        setPhotoLoading(false);
    }, [removeAvatar]);

    const handleSave = useCallback(async () => {
        setSaveError('');
        const result = await updateProfile({ name, username, avatar, bio });
        if (result?.success) {
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } else {
            setSaveError(result?.error || 'Erro ao salvar.');
        }
    }, [updateProfile, name, username, avatar, bio]);

    const handleClearData = useCallback(() => {
        if (window.confirm('Tem certeza que deseja limpar todos os dados? Esta ação é irreversível.')) {
            localStorage.clear();
            window.location.reload();
        }
    }, []);

    return (
        <div className="settings-panel animate-fade-in">
            <div className="settings-panel-header">
                <h2>{t.acTitle}</h2>
                <p>{t.acSubtitle}</p>
            </div>

            <div className="settings-section">
                <div className="settings-avatar-section">
                    <div className="settings-avatar-wrapper" ref={avatarMenuRef} style={{ position: 'relative' }}>
                        {photoUrl ? (
                            <img src={photoUrl} alt="avatar" className="settings-avatar-photo" />
                        ) : (
                            <div className="settings-avatar-large">{avatar || name?.[0] || '?'}</div>
                        )}
                        <div
                            className="settings-avatar-overlay"
                            onClick={() => setAvatarMenuOpen(v => !v)}
                            title={photoUrl ? t.avChangePhoto : t.avSetPhoto}
                            style={{ cursor: 'pointer' }}
                        >
                            <Camera size={20} color="#fff" />
                        </div>
                        {avatarMenuOpen && (
                            <div className="avatar-options-menu">
                                <button className="avatar-option-btn" onClick={() => { setAvatarMenuOpen(false); setShowCropper(true); }} disabled={photoLoading}>
                                    <Camera size={15} />
                                    {photoUrl ? t.avChangePhoto : t.avSetPhoto}
                                </button>
                                {photoUrl && (
                                    <button className="avatar-option-btn danger" onClick={handleRemovePhoto} disabled={photoLoading}>
                                        <Trash2 size={15} />
                                        {t.avRemovePhoto}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="settings-avatar-info">
                        <h3>{user?.name}</h3>
                        <p>{user?.email}</p>
                        {user?.username && <p className="settings-username">@{user.username}</p>}
                    </div>
                </div>
            </div>

            {showCropper && (
                <Suspense fallback={null}>
                    <AvatarCropper
                        onApply={handleAvatarUpload}
                        onClose={() => setShowCropper(false)}
                        t={t}
                    />
                </Suspense>
            )}

            <div className="settings-section">
                <h3 className="settings-section-title">{t.acPersonalInfo}</h3>
                <div className="settings-field">
                    <label>{t.acName}</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={t.acNamePh} />
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
                    <label>{t.acEmail}</label>
                    <input type="email" value={user?.email ?? ''} readOnly disabled placeholder="seu@email.com" className="settings-input-readonly" />
                    <p className="settings-field-hint">{t.acEmailHint}</p>
                </div>
                <div className="settings-field">
                    <label>{t.acBio}</label>
                    <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder={t.acBioPh} rows={2} className="settings-bio" />
                </div>
                {saveError && <p className="settings-error">{saveError}</p>}
                <div className="settings-actions">
                    <button className="btn btn-primary" onClick={handleSave}>
                        <Save size={16} />
                        {saved ? t.acSaved : t.acSave}
                    </button>
                </div>
            </div>

            <div className="settings-section settings-danger-zone">
                <h3 className="settings-section-title">{t.acDangerZone}</h3>
                <div className="settings-danger-card">
                    <div>
                        <strong>{t.acClearData}</strong>
                        <p>{t.acClearDataDesc}</p>
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={handleClearData}>{t.acClearBtn}</button>
                </div>
                <div className="settings-danger-card">
                    <div>
                        <strong>{t.acLogout}</strong>
                        <p>{t.acLogoutDesc}</p>
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={confirmLogout}>
                        <LogOut size={14} />
                        {t.acLogoutBtn}
                    </button>
                </div>
            </div>
        </div>
    );
});

// ─────────────────────────────────────────────
// SECURITY PANEL (sem MFA)
// ─────────────────────────────────────────────
const SecurityPanel = memo(function SecurityPanel({ user, getLinkedIdentities, linkIdentity, unlinkIdentity, setPassword, t }) {
    const [identities, setIdentities] = useState([]);
    const [identitiesLoading, setIdentitiesLoading] = useState(false);
    const [linkError, setLinkError] = useState('');
    const [passwordCurrent, setPasswordCurrent] = useState('');
    const [passwordNew, setPasswordNew] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState(false);

    // Load identities once on mount  
    useEffect(() => {
        if (!user) return;
        setIdentitiesLoading(true);
        setLinkError('');
        getLinkedIdentities().then(({ identities: ids }) => {
            setIdentities(ids || []);
            setIdentitiesLoading(false);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // intentionally stable — SecurityPanel mounts only once per tab activation

    const refreshIdentities = useCallback(async () => {
        const { identities: ids } = await getLinkedIdentities();
        setIdentities(ids || []);
    }, [getLinkedIdentities]);

    const hasEmailIdentity = identities.some(i => i.provider === 'email');
    const hasPassword = hasEmailIdentity || user?.has_password;
    const verified = user?.email_confirmed_at && hasEmailIdentity;

    return (
        <div className="settings-panel animate-fade-in">
            <div className="settings-panel-header">
                <h2>{t.secTitle}</h2>
                <p>{t.secSubtitle}</p>
            </div>

            {/* Email login badges */}
            <div className="settings-section">
                <h3 className="settings-section-title">{t.secEmailLogin}</h3>
                <div className="settings-status-badges">
                    {verified && <span className="settings-badge settings-badge-success"><ShieldCheck size={14} /> {t.secEmailVerified}</span>}
                    {hasPassword && <span className="settings-badge settings-badge-success"><ShieldCheck size={14} /> {t.secPasswordLinked}</span>}
                    {!hasPassword && identities.length > 0 && <span className="settings-badge settings-badge-neutral">{t.secNoPasswordHint}</span>}
                    {identities.length === 0 && !user?.email_confirmed_at && <span className="settings-badge settings-badge-warning">Não verificado</span>}
                </div>
            </div>

            {/* Password */}
            <div className="settings-section">
                <h3 className="settings-section-title">{t.secPassword}</h3>
                {!hasPassword ? (
                    <>
                        <p className="settings-section-desc">{t.secSetPasswordDesc}</p>
                        {passwordSuccess && <p className="settings-success">{t.secPasswordSuccess}</p>}
                        {passwordError && <p className="settings-error">{passwordError}</p>}
                        <div className="settings-field">
                            <label>{t.secNewPassword}</label>
                            <input type="password" value={passwordNew} onChange={e => { setPasswordNew(e.target.value); setPasswordError(''); }} placeholder={t.secNewPasswordPh} minLength={6} autoComplete="new-password" />
                        </div>
                        <div className="settings-field">
                            <label>{t.secConfirmPassword}</label>
                            <input type="password" value={passwordConfirm} onChange={e => { setPasswordConfirm(e.target.value); setPasswordError(''); }} placeholder={t.secPasswordPh2} autoComplete="new-password" />
                        </div>
                        <button type="button" className="btn btn-primary btn-sm"
                            disabled={!passwordNew || passwordNew !== passwordConfirm || passwordNew.length < 6}
                            onClick={async () => {
                                setPasswordError(''); setPasswordSuccess(false);
                                if (passwordNew !== passwordConfirm) { setPasswordError('As senhas não coincidem.'); return; }
                                const result = await setPassword(passwordNew);
                                if (result.success) {
                                    setPasswordSuccess(true); setPasswordNew(''); setPasswordConfirm('');
                                    await refreshIdentities();
                                } else { setPasswordError(result.error || 'Erro ao definir senha.'); }
                            }}
                        >{t.secSetPassword}</button>
                    </>
                ) : (
                    <>
                        {passwordSuccess && <p className="settings-success">{t.secPasswordChanged}</p>}
                        {passwordError && <p className="settings-error">{passwordError}</p>}
                        <div className="settings-field">
                            <label>{t.secCurrentPassword}</label>
                            <input type="password" value={passwordCurrent} onChange={e => { setPasswordCurrent(e.target.value); setPasswordError(''); }} placeholder={t.secCurrentPasswordPh} autoComplete="current-password" />
                        </div>
                        <div className="settings-field">
                            <label>{t.secNewPassword}</label>
                            <input type="password" value={passwordNew} onChange={e => { setPasswordNew(e.target.value); setPasswordError(''); }} placeholder={t.secNewPasswordPh} minLength={6} autoComplete="new-password" />
                        </div>
                        <div className="settings-field">
                            <label>{t.secConfirmPasswordNew}</label>
                            <input type="password" value={passwordConfirm} onChange={e => { setPasswordConfirm(e.target.value); setPasswordError(''); }} placeholder={t.secPasswordPh3} autoComplete="new-password" />
                        </div>
                        <button type="button" className="btn btn-primary btn-sm"
                            disabled={!passwordCurrent || !passwordNew || passwordNew !== passwordConfirm || passwordNew.length < 6}
                            onClick={async () => {
                                setPasswordError(''); setPasswordSuccess(false);
                                if (passwordNew !== passwordConfirm) { setPasswordError('As senhas não coincidem.'); return; }
                                const { supabase } = await import('../../services/supabaseClient');
                                const { error: signInError } = await supabase.auth.signInWithPassword({ email: user?.email, password: passwordCurrent });
                                if (signInError) { setPasswordError('Senha atual incorreta.'); return; }
                                const result = await setPassword(passwordNew);
                                if (result.success) {
                                    setPasswordSuccess(true); setPasswordCurrent(''); setPasswordNew(''); setPasswordConfirm('');
                                } else { setPasswordError(result.error || 'Erro ao alterar senha.'); }
                            }}
                        >{t.secChangePassword}</button>
                    </>
                )}
            </div>

            {/* Linked accounts */}
            <div className="settings-section">
                <h3 className="settings-section-title">{t.secLinkedAccounts}</h3>
                <p className="settings-section-desc">{t.secLinkedDesc}</p>
                {identitiesLoading && <p className="settings-muted">{t.secLoading}</p>}
                {linkError && <p className="settings-error">{linkError}</p>}
                <div className="settings-identities">
                    {PROVIDERS.map(({ id, label, icon: Icon }) => {
                        const linked = identities.find(i => i.provider === (id === 'microsoft' ? 'azure' : id));
                        return (
                            <div key={id} className="settings-identity-row">
                                <Icon size={20} />
                                <span>{label}</span>
                                <span className="settings-identity-status">
                                    {linked ? `${t.secLinked} (${linked.identity_data?.email ?? linked.email ?? '—'})` : t.secNotLinked}
                                </span>
                                {linked ? (
                                    <button type="button" className="btn btn-ghost btn-sm"
                                        onClick={async () => {
                                            const result = await unlinkIdentity(linked);
                                            if (result.success) { await refreshIdentities(); setLinkError(''); }
                                            else setLinkError(result.error || 'Não foi possível desvincular.');
                                        }}
                                    ><Unlink size={14} /> {t.secUnlink}</button>
                                ) : (
                                    <button type="button" className="btn btn-primary btn-sm"
                                        onClick={async () => {
                                            setLinkError('');
                                            const result = await linkIdentity(id);
                                            if (!result.success && result.error) {
                                                const msg = result.error.toLowerCase().includes('manual linking') || result.error.includes('linking is disabled')
                                                    ? 'Vinculação manual está desativada no Supabase. Ative em Authentication > Providers > Identity linking.'
                                                    : result.error;
                                                setLinkError(msg);
                                            }
                                        }}
                                    ><Link2 size={14} /> {t.secLink}</button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
});

// ─────────────────────────────────────────────
// APPEARANCE PANEL
// ─────────────────────────────────────────────
const ITEMS_PER_PAGE = 10; // 2 rows × 5 columns

const AppearancePanel = memo(function AppearancePanel({ theme, toggleTheme, setTheme, THEME_PRESETS, accentId, setAccent, ACCENT_PRESETS, customAccentValue, setCustomAccent, fontId, setFont, FONT_PRESETS, animStyle, setAnimStyle, t }) {
    const accentItemsWithCustom = useMemo(() => [...ACCENT_PRESETS, { id: CUSTOM_ACCENT_ID, isCustom: true }], [ACCENT_PRESETS]);
    const [zoom, setZoom] = useState(() => {
        const stored = localStorage.getItem('dailyways_zoom');
        return stored ? parseInt(stored) : 100;
    });
    const [accentPage, setAccentPage] = useState(0);
    const [customPopoverOpen, setCustomPopoverOpen] = useState(false);
    const customButtonRef = useRef(null);
    const totalPages = Math.ceil(accentItemsWithCustom.length / ITEMS_PER_PAGE);
    const pageItems = accentItemsWithCustom.slice(accentPage * ITEMS_PER_PAGE, (accentPage + 1) * ITEMS_PER_PAGE);

    // Jump to the page containing current accent
    useEffect(() => {
        const idx = accentItemsWithCustom.findIndex(p => p.id === accentId);
        if (idx >= 0) setAccentPage(Math.floor(idx / ITEMS_PER_PAGE));
    }, [accentId, accentItemsWithCustom]);

    const handleZoom = useCallback((value) => {
        const clamped = Math.min(150, Math.max(75, value));
        setZoom(clamped);
        localStorage.setItem('dailyways_zoom', clamped);
        document.documentElement.style.fontSize = `${clamped}%`;
    }, []);

    const currentFont = FONT_PRESETS.find(f => f.id === fontId);

    // Theme preview colors map
    const THEME_VISUALS = {
        light: { bg: '#f8f8f8', sidebar: '#ffffff', header: '#ffffff', card: '#ffffff', cardBorder: '#e5e7eb' },
        latte: { bg: '#faf7f2', sidebar: '#ffffff', header: '#f5f1ea', card: '#ffffff', cardBorder: '#e3d5ca' },
        ocean: { bg: '#f0f7ff', sidebar: '#ffffff', header: '#e6f1ff', card: '#ffffff', cardBorder: '#e2e8f0' },
        nord: { bg: '#d8d5d5', sidebar: '#e9e9e9', header: '#e9e9e9', card: '#e9e9e9', cardBorder: 'rgba(0,0,0,0.08)' },
        dark: { bg: '#0f0b1a', sidebar: '#1a1429', header: '#1a1429', card: '#1a1429', cardBorder: '#2d2542' },
        midnight: { bg: '#050510', sidebar: '#050510', header: '#0a0a1a', card: '#0a0a1a', cardBorder: '#161630' },
        dim: { bg: '#1a1715', sidebar: '#231f1d', header: '#231f1d', card: '#231f1d', cardBorder: 'rgba(237,228,217,0.1)' },
        oled: { bg: '#000000', sidebar: '#000000', header: '#0a0a0a', card: '#0d0d0d', cardBorder: '#1a1a1a' },
    };
    const THEME_ICONS = {
        light: <Sun size={14} />,
        latte: <span style={{ fontSize: 13 }}>☕</span>,
        ocean: <span style={{ fontSize: 13 }}>🌊</span>,
        nord: <Cloud size={14} />,
        dark: <Moon size={14} />,
        midnight: <span style={{ fontSize: 13 }}>✨</span>,
        dim: <span style={{ fontSize: 13 }}>🌙</span>,
        oled: <span style={{ fontSize: 13 }}>⚫</span>,
    };
    const THEME_LABELS = {
        light: t.sThemeLight,
        latte: 'Latte',
        ocean: 'Ocean',
        nord: 'Nord',
        dark: t.sThemeDark,
        midnight: 'Midnight',
        dim: 'Dim',
        oled: 'OLED'
    };

    return (
        <div className="settings-panel animate-fade-in">
            <div className="settings-panel-header">
                <h2>{t.appTitle}</h2>
                <p>{t.appSubtitle}</p>
            </div>

            {/* Theme */}
            <div className="settings-section">
                <h3 className="settings-section-title">{t.sTheme}</h3>
                <div className="settings-theme-grid settings-theme-grid-4">
                    {(THEME_PRESETS || [
                        { id: 'light' }, { id: 'dark' }, { id: 'dim' }, { id: 'oled' }
                    ]).map(({ id }) => {
                        const v = THEME_VISUALS[id] || THEME_VISUALS.dark;
                        return (
                            <button
                                key={id}
                                className={`settings-theme-card ${theme === id ? 'active' : ''}`}
                                onClick={() => setTheme(id)}
                            >
                                <div className="settings-theme-preview" style={{ background: v.bg }}>
                                    <div className="stp-sidebar" style={{ background: v.sidebar }} />
                                    <div className="stp-content">
                                        <div className="stp-header" style={{ background: v.header }} />
                                        <div className="stp-cards">
                                            <div className="stp-card" style={{ background: v.card, borderColor: v.cardBorder }} />
                                            <div className="stp-card" style={{ background: v.card, borderColor: v.cardBorder }} />
                                        </div>
                                    </div>
                                </div>
                                <div className="settings-theme-label">{THEME_ICONS[id]}<span>{THEME_LABELS[id]}</span></div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Accent */}
            <div className="settings-section">
                <h3 className="settings-section-title">{t.sAccentColor}</h3>
                <p className="settings-section-desc">{t.sAccentDesc}</p>
                <div className="settings-accent-carousel">
                    <button
                        className="btn-icon settings-accent-arrow"
                        onClick={() => setAccentPage(p => Math.max(0, p - 1))}
                        disabled={accentPage === 0}
                    >
                        <ChevLeft size={20} />
                    </button>
                    <div className="settings-accent-grid">
                        {pageItems.map(preset => preset.isCustom ? (
                            <button
                                key={preset.id}
                                ref={customButtonRef}
                                className={`settings-accent-btn settings-accent-btn-custom ${accentId === CUSTOM_ACCENT_ID ? 'active' : ''}`}
                                onClick={() => setCustomPopoverOpen(true)}
                                title="Personalizado"
                            >
                                <span className="settings-accent-custom-dot">
                                    <Plus size={16} strokeWidth={2.5} />
                                </span>
                                <span className="settings-accent-name">Personalizado</span>
                            </button>
                        ) : (
                            <button
                                key={preset.id}
                                className={`settings-accent-btn ${accentId === preset.id ? 'active' : ''}`}
                                onClick={() => setAccent(preset.id)}
                                title={preset.name}
                            >
                                <span
                                    className="settings-accent-color"
                                    style={{ background: preset.gradient || `linear-gradient(135deg, ${preset.color}, ${preset.secondary})` }}
                                />
                                <span className="settings-accent-name">{preset.name}</span>
                            </button>
                        ))}
                    </div>
                    <button
                        className="btn-icon settings-accent-arrow"
                        onClick={() => setAccentPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={accentPage === totalPages - 1}
                    >
                        <ChevRight size={20} />
                    </button>
                </div>
                <div className="settings-accent-dots">
                    {Array.from({ length: totalPages }).map((_, i) => (
                        <button
                            key={i}
                            className={`settings-font-dot ${i === accentPage ? 'active' : ''}`}
                            onClick={() => setAccentPage(i)}
                        />
                    ))}
                </div>
                {customPopoverOpen && (
                    <CustomAccentPopover
                        anchorRef={customButtonRef}
                        value={customAccentValue}
                        onApply={(v) => { setCustomAccent(v); }}
                        onClose={() => setCustomPopoverOpen(false)}
                    />
                )}
            </div>

            {/* Zoom */}
            <div className="settings-section">
                <h3 className="settings-section-title">{t.sZoom}</h3>
                <div className="settings-zoom-control">
                    <button className="btn-icon" onClick={() => handleZoom(zoom - 10)} disabled={zoom <= 75}><ZoomOut size={18} /></button>
                    <div className="settings-zoom-bar">
                        <input type="range" min="75" max="150" step="5" value={zoom} onChange={e => handleZoom(parseInt(e.target.value))} />
                        <span className="settings-zoom-value">{zoom}%</span>
                    </div>
                    <button className="btn-icon" onClick={() => handleZoom(zoom + 10)} disabled={zoom >= 150}><ZoomIn size={18} /></button>
                </div>
            </div>

            {/* Font */}
            <div className="settings-section">
                <h3 className="settings-section-title">{t.sFont}</h3>
                <p className="settings-section-desc">{t.sFontDesc}</p>
                <div className="settings-font-picker">
                    <button className="btn-icon settings-font-arrow" onClick={() => { const idx = FONT_PRESETS.findIndex(f => f.id === fontId); setFont(FONT_PRESETS[(idx - 1 + FONT_PRESETS.length) % FONT_PRESETS.length].id); }}>
                        <ChevLeft size={20} />
                    </button>
                    <div className="settings-font-display">
                        <span className="settings-font-name" style={{ fontFamily: currentFont?.family }}>{currentFont?.name || 'Poppins'}</span>
                        <span className="settings-font-preview" style={{ fontFamily: currentFont?.family }}>Aa Bb Cc 1 2 3</span>
                    </div>
                    <button className="btn-icon settings-font-arrow" onClick={() => { const idx = FONT_PRESETS.findIndex(f => f.id === fontId); setFont(FONT_PRESETS[(idx + 1) % FONT_PRESETS.length].id); }}>
                        <ChevRight size={20} />
                    </button>
                </div>
                <div className="settings-font-dots">
                    {FONT_PRESETS.map(f => (
                        <button key={f.id} className={`settings-font-dot ${f.id === fontId ? 'active' : ''}`} onClick={() => setFont(f.id)} title={f.name} />
                    ))}
                </div>
            </div>

            {/* Animation */}
            <div className="settings-section">
                <h3 className="settings-section-title">{t.sAnimStyle}</h3>
                <p className="settings-section-desc">{t.sAnimDesc}</p>
                <div className="settings-anim-grid">
                    {[
                        { id: 'default', label: t.sAnimSmooth, desc: t.sAnimSmoothDesc, emoji: '✨' },
                        { id: 'flat', label: t.sAnimFlat, desc: t.sAnimFlatDesc, emoji: '⚡' },
                    ].map(opt => (
                        <button key={opt.id} className={`settings-anim-card ${animStyle === opt.id ? 'active' : ''}`} onClick={() => setAnimStyle(opt.id)}>
                            <span className="settings-anim-emoji">{opt.emoji}</span>
                            <strong>{opt.label}</strong>
                            <span className="settings-anim-desc">{opt.desc}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
});

// ─────────────────────────────────────────────
// APP PANEL
// ─────────────────────────────────────────────
const AppPanel = memo(function AppPanel({ t }) {
    const [notifications, setNotifications] = useState(true);
    const [sounds, setSounds] = useState(true);
    const [autoSave, setAutoSave] = useState(true);

    return (
        <div className="settings-panel animate-fade-in">
            <div className="settings-panel-header">
                <h2>{t.appTabTitle}</h2>
                <p>{t.appTabSubtitle}</p>
            </div>
            <div className="settings-section">
                <h3 className="settings-section-title">{t.sNotifications}</h3>
                {[
                    { icon: Bell, label: t.sNotifPush, desc: t.sNotifPushDesc, val: notifications, set: setNotifications },
                    { icon: Smartphone, label: t.sSounds, desc: t.sSoundsDesc, val: sounds, set: setSounds },
                    { icon: Save, label: t.sAutoSave, desc: t.sAutoSaveDesc, val: autoSave, set: setAutoSave },
                ].map(({ icon: Icon, label, desc, val, set }) => (
                    <div key={label} className="settings-toggle-row">
                        <div className="settings-toggle-info">
                            <Icon size={18} />
                            <div><strong>{label}</strong><p>{desc}</p></div>
                        </div>
                        <button className={`settings-toggle ${val ? 'active' : ''}`} onClick={() => set(!val)}>
                            <span className="settings-toggle-thumb" />
                        </button>
                    </div>
                ))}
            </div>
            <div className="settings-section">
                <h3 className="settings-section-title">{t.sData}</h3>
                <div className="settings-info-row"><span>{t.sVersion}</span><span className="settings-info-value">{pkg.version}</span></div>
                <div className="settings-info-row"><span>{t.sStorage}</span><span className="settings-info-value">Supabase (PostgreSQL)</span></div>
            </div>
        </div>
    );
});

// ─────────────────────────────────────────────
// INVITATIONS PANEL
// ─────────────────────────────────────────────
const InvitationsPanel = memo(function InvitationsPanel({ t }) {
    const { reloadBoards } = useApp();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [items, setItems] = useState([]);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        const { data, error: err } = await fetchMyInvitations();
        if (err) setError(err);
        setItems(data || []);
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleAccept = async (id) => {
        setError('');
        const res = await acceptInvitation(id);
        if (!res.success) {
            setError(res.error || 'Erro ao aceitar convite.');
        } else {
            await load();
            // Recarrega boards para o board compartilhado aparecer na sidebar
            await reloadBoards();
        }
    };

    const handleDecline = async (id) => {
        setError('');
        const res = await declineInvitation(id);
        if (!res.success) {
            setError(res.error || 'Erro ao recusar convite.');
        } else {
            await load();
        }
    };

    return (
        <div className="settings-panel animate-fade-in">
            <div className="settings-panel-header">
                <h2>Convites de Boards</h2>
                <p>Veja e gerencie convites para boards compartilhados com você.</p>
            </div>

            <div className="settings-section">
                {loading && <p className="settings-muted">Carregando convites...</p>}
                {error && <p className="settings-error">{error}</p>}
                {!loading && items.length === 0 && !error && (
                    <p className="settings-muted">Você não tem convites pendentes.</p>
                )}
                {!loading && items.length > 0 && (
                    <div className="settings-invitations-list">
                        {items.map(inv => (
                            <div key={inv.id} className="settings-invitation-row">
                                <div className="settings-invitation-main">
                                    <div className="settings-invitation-emoji">
                                        {inv.boardEmoji || '📋'}
                                    </div>
                                    <div>
                                        <div className="settings-invitation-title">
                                            {inv.boardTitle}
                                        </div>
                                        <div className="settings-invitation-meta">
                                            Acesso como {inv.role === 'editor' ? 'editor' : 'leitor'} · convidado para {inv.inviteeEmail}
                                        </div>
                                    </div>
                                </div>
                                <div className="settings-invitation-actions">
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => handleDecline(inv.id)}
                                    >
                                        Recusar
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        onClick={() => handleAccept(inv.id)}
                                    >
                                        Aceitar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
});

// ─────────────────────────────────────────────
// LANGUAGE PANEL
// ─────────────────────────────────────────────
const LANGUAGES = [
    { id: 'pt-br', label: 'Português (Brasil)', flag: '🇧🇷' },
    { id: 'en', label: 'English', flag: '🇺🇸' },
    { id: 'es', label: 'Español', flag: '🇪🇸' },
    { id: 'fr', label: 'Français', flag: '🇫🇷' },
    { id: 'de', label: 'Deutsch', flag: '🇩🇪' },
    { id: 'ja', label: '日本語', flag: '🇯🇵' },
];

const LanguagePanel = memo(function LanguagePanel({ language, setLanguage, t }) {
    return (
        <div className="settings-panel animate-fade-in">
            <div className="settings-panel-header">
                <h2>{t.sLanguage}</h2>
                <p>{t.sLanguageSubtitle}</p>
            </div>
            <div className="settings-section">
                <div className="settings-language-grid">
                    {LANGUAGES.map(lang => (
                        <button key={lang.id} className={`settings-language-btn ${language === lang.id ? 'active' : ''}`} onClick={() => setLanguage(lang.id)}>
                            <span className="settings-language-flag">{lang.flag}</span>
                            <span className="settings-language-label">{lang.label}</span>
                            {language === lang.id && <span className="settings-language-check">✓</span>}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
});

// ─────────────────────────────────────────────
// SETTINGS MODAL (thin shell — only holds tab state)
// ─────────────────────────────────────────────
export default function SettingsModal({ onClose, initialTab = 'account' }) {
    const {
        user, updateProfile, confirmLogout,
        getLinkedIdentities, linkIdentity, unlinkIdentity,
        setPassword, uploadAvatar, removeAvatar,
    } = useAuth();
    const { theme, toggleTheme, setTheme, accentId, setAccent, ACCENT_PRESETS, THEME_PRESETS, fontId, setFont, FONT_PRESETS, language, setLanguage, animStyle, setAnimStyle, CUSTOM_ACCENT_ID, customAccentValue, setCustomAccent } = useTheme();
    const t = useI18n();

    const [activeTab, setActiveTab] = useState(initialTab);

    const tabs = [
        { id: 'account', label: t.stAccount, icon: User },
        { id: 'security', label: t.stSecurity, icon: Shield },
        { id: 'invitations', label: 'Convites', icon: Users },
        { id: 'appearance', label: t.stAppearance, icon: Palette },
        { id: 'app', label: t.stApp, icon: Smartphone },
        { id: 'language', label: t.stLanguage, icon: Globe },
    ];

    // Close on Escape
    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    return createPortal(
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="settings-modal animate-scale-in-centered">
                <button className="settings-modal-close btn-icon" onClick={onClose}>
                    <X size={20} />
                </button>

                <div className="settings-container">
                    {/* Tabs Sidebar */}
                    <div className="settings-tabs">
                        <div className="settings-tabs-title">
                            <img src={['light', 'latte', 'ocean', 'nord'].includes(theme) ? logoBlack : logoWhite} alt="DailyWays" className="settings-logo-img" />
                            {t.settings}
                        </div>
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                type="button"
                                className={`settings-tab ${activeTab === tab.id ? 'settings-tab-active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                                aria-label={tab.label}
                                title={tab.label}
                            >
                                <tab.icon size={18} className="settings-tab-icon" aria-hidden />
                                <span className="settings-tab-label">{tab.label}</span>
                                <ChevronRight size={14} className="settings-tab-arrow" aria-hidden />
                            </button>
                        ))}
                    </div>

                    {/* Content: only the active panel is rendered */}
                    <div className="settings-content">
                        {activeTab === 'account' && (
                            <AccountPanel
                                user={user}
                                updateProfile={updateProfile}
                                confirmLogout={confirmLogout}
                                uploadAvatar={uploadAvatar}
                                removeAvatar={removeAvatar}
                                t={t}
                            />
                        )}
                        {activeTab === 'security' && (
                            <SecurityPanel
                                user={user}
                                getLinkedIdentities={getLinkedIdentities}
                                linkIdentity={linkIdentity}
                                unlinkIdentity={unlinkIdentity}
                                setPassword={setPassword}
                                t={t}
                            />
                        )}
                        {activeTab === 'appearance' && (
                            <AppearancePanel
                                theme={theme} toggleTheme={toggleTheme} setTheme={setTheme} THEME_PRESETS={THEME_PRESETS}
                                accentId={accentId} setAccent={setAccent} ACCENT_PRESETS={ACCENT_PRESETS}
                                customAccentValue={customAccentValue} setCustomAccent={setCustomAccent}
                                fontId={fontId} setFont={setFont} FONT_PRESETS={FONT_PRESETS}
                                animStyle={animStyle} setAnimStyle={setAnimStyle}
                                t={t}
                            />
                        )}
                        {activeTab === 'app' && <AppPanel t={t} />}
                        {activeTab === 'invitations' && <InvitationsPanel t={t} />}
                        {activeTab === 'language' && (
                            <LanguagePanel language={language} setLanguage={setLanguage} t={t} />
                        )}
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
}
