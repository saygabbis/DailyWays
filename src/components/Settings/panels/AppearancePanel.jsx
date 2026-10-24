import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { Sun, Moon, ZoomIn, ZoomOut, Cloud, ChevronLeft as ChevLeft, ChevronRight as ChevRight } from 'lucide-react';
import { Plus } from 'lucide-react';
import CustomAccentPopover from '../CustomAccentPopover';
import { CUSTOM_ACCENT_ID } from '../../../context/ThemeContext';
import { PRESENCE_COLOR_PRESETS } from '../../../utils/presenceColor';
import '../Settings.css';
import '../AvatarCropper.css';

// ─────────────────────────────────────────────
// APPEARANCE PANEL
// ─────────────────────────────────────────────
const ITEMS_PER_PAGE = 10;

const AppearancePanel = memo(function AppearancePanel({
    theme, setTheme, THEME_PRESETS, accentId, setAccent, ACCENT_PRESETS,
    customAccentValue, setCustomAccent, fontId, setFont, FONT_PRESETS, animStyle, setAnimStyle,
    user, updateProfile, t,
}) {
    const [presenceAuto, setPresenceAuto] = useState(user?.presence_color_auto !== false);
    const [presenceColor, setPresenceColor] = useState(
        user?.presence_color || PRESENCE_COLOR_PRESETS[0]
    );

    useEffect(() => {
        setPresenceAuto(user?.presence_color_auto !== false);
        setPresenceColor(user?.presence_color || PRESENCE_COLOR_PRESETS[0]);
    }, [user?.presence_color, user?.presence_color_auto]);
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

            {/* Collab presence color */}
            <div className="settings-section">
                <h3 className="settings-section-title">Cor de presença</h3>
                <p className="settings-section-desc">
                    Cursor e destaque em boards partilhados. Automático usa a foto de perfil.
                </p>
                <label className="settings-presence-auto-row">
                    <span>Automático (da foto)</span>
                    <input
                        type="checkbox"
                        checked={presenceAuto}
                        onChange={async (e) => {
                            const auto = e.target.checked;
                            setPresenceAuto(auto);
                            await updateProfile({
                                presence_color_auto: auto,
                                presence_color: auto ? null : presenceColor,
                            });
                        }}
                    />
                </label>
                {!presenceAuto && (
                    <div className="settings-presence-colors">
                        {PRESENCE_COLOR_PRESETS.map((c) => (
                            <button
                                key={c}
                                type="button"
                                className={`settings-presence-swatch ${presenceColor === c ? 'active' : ''}`}
                                style={{ background: c }}
                                title={c}
                                onClick={async () => {
                                    setPresenceColor(c);
                                    await updateProfile({ presence_color: c, presence_color_auto: false });
                                }}
                            />
                        ))}
                        <input
                            type="color"
                            className="settings-presence-picker"
                            value={presenceColor}
                            onChange={async (e) => {
                                setPresenceColor(e.target.value);
                                await updateProfile({
                                    presence_color: e.target.value,
                                    presence_color_auto: false,
                                });
                            }}
                        />
                    </div>
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

export default AppearancePanel;
