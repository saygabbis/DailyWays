import { memo } from 'react';

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

export default LanguagePanel;
