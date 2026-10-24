import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme, useI18n } from '../../context/ThemeContext';
import { User, Palette, Globe, Smartphone, ChevronRight, Shield, X, ShieldCheck, Users } from 'lucide-react';
import logoWhite from '../../assets/Logo - Branco.png';
import logoBlack from '../../assets/Logo - Preto.png';
import './Settings.css';
import AccountPanel from './panels/AccountPanel';
import SecurityPanel from './panels/SecurityPanel';
import AppearancePanel from './panels/AppearancePanel';
import AppPanel from './panels/AppPanel';
import InvitationsPanel from './panels/InvitationsPanel';
import LanguagePanel from './panels/LanguagePanel';
import ContactsPanel from './panels/ContactsPanel';
import PrivacyPanel from './panels/PrivacyPanel';

 // 2 rows × 5 columns

// ─────────────────────────────────────────────
// SETTINGS MODAL (thin shell — only holds tab state)
// ─────────────────────────────────────────────
export default function SettingsModal({ onClose, initialTab = 'account' }) {
    const {
        user, updateProfile, confirmLogout,
        getLinkedIdentities, linkIdentity, unlinkIdentity,
        setPassword, uploadAvatar, removeAvatar,
    } = useAuth();
    const { theme, toggleTheme, setTheme, accentId, setAccent, ACCENT_PRESETS, THEME_PRESETS, fontId, setFont, FONT_PRESETS, language, setLanguage, animStyle, setAnimStyle, customAccentValue, setCustomAccent } = useTheme();
    const t = useI18n();

    const [activeTab, setActiveTab] = useState(initialTab);

    const tabs = [
        { id: 'account', label: t.stAccount, icon: User },
        { id: 'security', label: t.stSecurity, icon: Shield },
        { id: 'invitations', label: 'Convites', icon: Users },
        { id: 'contacts', label: 'Contatos', icon: Users },
        { id: 'privacy', label: 'Privacidade', icon: ShieldCheck },
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
                        {activeTab === 'contacts' && <ContactsPanel user={user} />}
                        {activeTab === 'privacy' && <PrivacyPanel user={user} />}
                        {activeTab === 'appearance' && (
                            <AppearancePanel
                                theme={theme} toggleTheme={toggleTheme} setTheme={setTheme} THEME_PRESETS={THEME_PRESETS}
                                accentId={accentId} setAccent={setAccent} ACCENT_PRESETS={ACCENT_PRESETS}
                                customAccentValue={customAccentValue} setCustomAccent={setCustomAccent}
                                fontId={fontId} setFont={setFont} FONT_PRESETS={FONT_PRESETS}
                                animStyle={animStyle} setAnimStyle={setAnimStyle}
                                user={user}
                                updateProfile={updateProfile}
                                t={t}
                            />
                        )}
                        {activeTab === 'app' && <AppPanel t={t} />}
                        {activeTab === 'invitations' && <InvitationsPanel />}
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
