import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import storageService from '../services/storageService';
import { supabase } from '../services/supabaseClient';
import logoFaviconLight from '../assets/logo.png';
import logoFaviconDark from '../assets/Logo - Branco.png';
import { ThemeContext } from './useTheme';
import { readableTextOn } from '../utils/contrastingTextColor';



const ACCENT_PRESETS = [
    // ── Sólidas ──
    { id: 'purple', name: 'Roxo', color: '#7c3aed', secondary: '#6d28d9' },
    { id: 'blue', name: 'Azul', color: '#3b82f6', secondary: '#2563eb' },
    { id: 'sky', name: 'Céu', color: '#0ea5e9', secondary: '#0284c7' },
    { id: 'cyan', name: 'Ciano', color: '#06b6d4', secondary: '#0891b2' },
    { id: 'teal', name: 'Turquesa', color: '#14b8a6', secondary: '#0d9488' },
    { id: 'green', name: 'Verde', color: '#10b981', secondary: '#059669' },
    { id: 'lime', name: 'Lima', color: '#84cc16', secondary: '#65a30d' },
    { id: 'amber', name: 'Âmbar', color: '#f59e0b', secondary: '#d97706' },
    { id: 'orange', name: 'Laranja', color: '#f97316', secondary: '#ea580c' },
    { id: 'rose', name: 'Rosa', color: '#f43f5e', secondary: '#e11d48' },
    { id: 'crimson', name: 'Carmesim', color: '#dc2626', secondary: '#b91c1c' },
    { id: 'pink', name: 'Rosa Claro', color: '#ec4899', secondary: '#db2777' },
    { id: 'fuchsia', name: 'Fúcsia', color: '#d946ef', secondary: '#c026d3' },
    { id: 'violet', name: 'Violeta', color: '#8b5cf6', secondary: '#7c3aed' },
    { id: 'indigo', name: 'Índigo', color: '#6366f1', secondary: '#4f46e5' },
    { id: 'slate', name: 'Ardósia', color: '#64748b', secondary: '#475569' },
    // ── Gradientes ──
    { id: 'grad-aurora', name: 'Aurora', color: '#a855f7', secondary: '#06b6d4', gradient: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' },
    { id: 'grad-sunset', name: 'Pôr do Sol', color: '#f97316', secondary: '#e11d48', gradient: 'linear-gradient(135deg, #f97316 0%, #e11d48 100%)' },
    { id: 'grad-ocean', name: 'Oceano', color: '#3b82f6', secondary: '#06b6d4', gradient: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)' },
    { id: 'grad-forest', name: 'Floresta', color: '#10b981', secondary: '#84cc16', gradient: 'linear-gradient(135deg, #10b981 0%, #84cc16 100%)' },
    { id: 'grad-candy', name: 'Candy', color: '#ec4899', secondary: '#a855f7', gradient: 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)' },
    { id: 'grad-fire', name: 'Chamas', color: '#dc2626', secondary: '#f97316', gradient: 'linear-gradient(135deg, #dc2626 0%, #f97316 100%)' },
    { id: 'grad-midnight', name: 'Meia-Noite', color: '#1e1b4b', secondary: '#4f46e5', gradient: 'linear-gradient(135deg, #1e1b4b 0%, #4f46e5 100%)' },
    { id: 'grad-rose-gold', name: 'Ouro Rosé', color: '#f43f5e', secondary: '#f59e0b', gradient: 'linear-gradient(135deg, #f43f5e 0%, #f59e0b 100%)' },
    // ── 5 novas cores (total 19 presets sólidos+gradientes antes do custom) ──
    { id: 'mint', name: 'Menta', color: '#34d399', secondary: '#10b981' },
    { id: 'coral', name: 'Coral', color: '#fb7185', secondary: '#f43f5e' },
    { id: 'gold', name: 'Dourado', color: '#eab308', secondary: '#ca8a04' },
    { id: 'grad-lavender', name: 'Lavanda', color: '#a78bfa', secondary: '#c084fc', gradient: 'linear-gradient(135deg, #a78bfa 0%, #c084fc 50%, #e879f9 100%)' },
    { id: 'grad-peach', name: 'Pêssego', color: '#fdba74', secondary: '#fb923c', gradient: 'linear-gradient(135deg, #fdba74 0%, #fb923c 100%)' },
];

export const CUSTOM_ACCENT_ID = 'custom';
const DEFAULT_CUSTOM_ACCENT = { type: 'solid', color: '#7c3aed' };

function buildAccentFromCustom(custom) {
    if (!custom || custom.type === 'solid') {
        const c = custom?.color || DEFAULT_CUSTOM_ACCENT.color;
        return { color: c, secondary: c, gradient: `linear-gradient(135deg, ${c} 0%, ${c} 100%)` };
    }
    const stops = custom.stops && custom.stops.length >= 2
        ? [...custom.stops].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        : [{ color: '#7c3aed', position: 0 }, { color: '#06b6d4', position: 100 }];
    const grad = `linear-gradient(135deg, ${stops.map(s => `${s.color} ${s.position ?? 0}%`).join(', ')})`;
    const color = stops[0].color;
    const secondary = stops[stops.length - 1].color;
    return { color, secondary, gradient: grad };
}

const THEME_PRESETS = [
    { id: 'light', name: 'Claro', icon: 'sun' },
    { id: 'latte', name: 'Latte', icon: 'coffee' },
    { id: 'ocean', name: 'Ocean', icon: 'cloud' },
    { id: 'nord', name: 'Nord', icon: 'cloud' },
    { id: 'dim', name: 'Dim', icon: 'dim' },
    { id: 'dark', name: 'Escuro', icon: 'moon' },
    { id: 'midnight', name: 'Midnight', icon: 'sparkle' },
    { id: 'oled', name: 'OLED', icon: 'oled' },
];

const FONT_PRESETS = [
    { id: 'poppins', name: 'Poppins', family: "'Poppins'", google: 'Poppins' },
    { id: 'inter', name: 'Inter', family: "'Inter'", google: 'Inter' },
    { id: 'nunito', name: 'Nunito', family: "'Nunito'", google: 'Nunito' },
    { id: 'outfit', name: 'Outfit', family: "'Outfit'", google: 'Outfit' },
    { id: 'dm-sans', name: 'DM Sans', family: "'DM Sans'", google: 'DM+Sans' },
    { id: 'raleway', name: 'Raleway', family: "'Raleway'", google: 'Raleway' },
];

function loadFontFamily(font) {
    if (typeof document === 'undefined' || !font?.google) return;
    const id = 'dw-font-link';
    const href = `https://fonts.googleapis.com/css2?family=${font.google}:wght@400;500;600;700&display=swap`;
    let link = document.getElementById(id);
    if (link?.getAttribute('href') === href) return;
    if (!link) {
        link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
    }
    link.setAttribute('href', href);
}






export function ThemeProvider({ children }) {
    const [theme, setThemeState] = useState(() =>
        storageService.load('dailyways_theme') || 'light'
    );

    const [accentId, setAccentId] = useState(() =>
        storageService.load('dailyways_accent') || 'purple'
    );

    const [customAccentValue, setCustomAccentValueState] = useState(() => {
        const raw = storageService.load('dailyways_custom_accent');
        if (!raw) return DEFAULT_CUSTOM_ACCENT;
        try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (parsed.type === 'gradient' && Array.isArray(parsed.stops) && parsed.stops.length >= 2) return parsed;
            if (parsed.type === 'solid' && parsed.color) return parsed;
        } catch (_) { /* ignore */ }
        return DEFAULT_CUSTOM_ACCENT;
    });

    const [fontId, setFontId] = useState(() =>
        storageService.load('dailyways_font') || 'poppins'
    );

    const [language, setLanguageState] = useState(() =>
        storageService.load('dailyways_language') || 'pt-br'
    );

    const [animStyle, setAnimStyleState] = useState(() =>
        storageService.load('dailyways_anim') || 'default'
    );

    // userId is stored so setters can save to DB
    const userIdRef = useRef(null);
    const dbSaveTimer = useRef(null);

    const saveToDb = useCallback((updates) => {
        if (!userIdRef.current) return;
        clearTimeout(dbSaveTimer.current);
        dbSaveTimer.current = setTimeout(() => {
            supabase.from('profiles').update({
                ...updates,
                updated_at: new Date().toISOString(),
            }).eq('id', userIdRef.current).then(({ error }) => {
                if (error) console.warn('[Theme] DB save error:', error.message);
            });
        }, 600);
    }, []);

    // Called by App.jsx after user logs in — loads profile prefs silently
    const initPreferences = useCallback((uid, profile) => {
        userIdRef.current = uid;
        if (!uid || !profile) return;
        const t = profile.theme || storageService.load('dailyways_theme') || 'dark';
        const a = profile.accent || storageService.load('dailyways_accent') || 'purple';
        const f = profile.font_id || storageService.load('dailyways_font') || 'poppins';
        const l = profile.language || storageService.load('dailyways_language') || 'pt-br';
        const an = profile.anim_style || storageService.load('dailyways_anim') || 'default';
        // Apply silently (no DB save triggered)
        setThemeState(t); storageService.save('dailyways_theme', t);
        setAccentId(a); storageService.save('dailyways_accent', a);
        setFontId(f); storageService.save('dailyways_font', f);
        setLanguageState(l); storageService.save('dailyways_language', l);
        setAnimStyleState(an); storageService.save('dailyways_anim', an);
    }, []);

    const accent = useMemo(() => {
        if (accentId === CUSTOM_ACCENT_ID) return buildAccentFromCustom(customAccentValue);
        return ACCENT_PRESETS.find(a => a.id === accentId) || ACCENT_PRESETS[0];
    }, [accentId, customAccentValue]);
    const font = FONT_PRESETS.find(f => f.id === fontId) || FONT_PRESETS[0];

    // Apply theme + accent to DOM
    useEffect(() => {
        const root = document.documentElement;
        root.setAttribute('data-theme', theme);
        storageService.save('dailyways_theme', theme);
    }, [theme]);

    // Favicon: branco em dark mode, padrão (preto) em light mode
    useEffect(() => {
        const isLightTheme = ['light', 'latte', 'ocean', 'nord'].includes(theme);
        const faviconHref = isLightTheme ? logoFaviconLight : logoFaviconDark;
        let link = document.querySelector('link[rel="icon"]');
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            link.type = 'image/png';
            document.head.appendChild(link);
        }
        link.href = faviconHref;
    }, [theme]);


    useEffect(() => {
        const root = document.documentElement;
        const grad = accent.gradient || `linear-gradient(135deg, ${accent.color} 0%, ${accent.secondary} 100%)`;
        root.style.setProperty('--accent-primary', accent.color);
        root.style.setProperty('--accent-secondary', accent.secondary);
        root.style.setProperty('--accent-gradient', grad);
        root.style.setProperty('--accent-gradient-hover', `linear-gradient(135deg, ${accent.color}dd 0%, ${accent.color} 100%)`);
        // Texto sobre o destaque: o que der mais contraste (WCAG). Branco fixo ficava ilegível em
        // destaques claros (dourado, lima, pêssego). Hover/seleção/sombras derivam do destaque no
        // CSS (styles/tokens.css) — sem hex fixo por tema aqui.
        root.style.setProperty('--accent-contrast', readableTextOn(accent.color, accent.secondary));
        storageService.save('dailyways_accent', accentId);
    }, [accent, accentId]);

    // Fonte: só a escolhida é baixada (antes o CSS importava 6 famílias × 6 pesos em todo acesso).
    useEffect(() => {
        document.documentElement.style.setProperty('--font-family', `${font.family}, system-ui, -apple-system, 'Segoe UI', sans-serif`);
        loadFontFamily(font);
        storageService.save('dailyways_font', fontId);
    }, [font, fontId]);

    // Persist language
    const setLanguage = (id) => {
        setLanguageState(id);
        storageService.save('dailyways_language', id);
        saveToDb({ language: id });
    };

    // Apply animation style to DOM
    useEffect(() => {
        document.documentElement.setAttribute('data-anim', animStyle);
        storageService.save('dailyways_anim', animStyle);
    }, [animStyle]);

    const setAnimStyle = (id) => {
        setAnimStyleState(id);
        saveToDb({ anim_style: id });
    };

    const setTheme = (val) => {
        setThemeState(val);
        saveToDb({ theme: val });
    };

    const toggleTheme = () => {
        setThemeState(prev => {
            const next = prev === 'light' ? 'dark' : 'light';
            saveToDb({ theme: next });
            return next;
        });
    };

    const setAccent = (id) => {
        setAccentId(id);
        saveToDb({ accent: id });
    };

    const setCustomAccent = useCallback((value) => {
        setCustomAccentValueState(value);
        storageService.save('dailyways_custom_accent', JSON.stringify(value));
        setAccentId(CUSTOM_ACCENT_ID);
        saveToDb({ accent: CUSTOM_ACCENT_ID });
    }, [saveToDb]);

    const setCustomAccentValue = useCallback((value) => {
        setCustomAccentValueState(value);
        storageService.save('dailyways_custom_accent', JSON.stringify(value));
    }, []);

    const setFont = (id) => {
        setFontId(id);
        saveToDb({ font_id: id });
    };

    const ctxValue = useMemo(() => ({
        theme, toggleTheme, setTheme, accentId, setAccent, accent, ACCENT_PRESETS, THEME_PRESETS,
        CUSTOM_ACCENT_ID, customAccentValue, setCustomAccent, setCustomAccentValue,
        fontId, setFont, FONT_PRESETS, language, setLanguage,
        animStyle, setAnimStyle, initPreferences,
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [theme, accentId, accent, customAccentValue, setCustomAccent, setCustomAccentValue, fontId, language, animStyle, initPreferences]);

    return (
        <ThemeContext.Provider value={ctxValue}>
            {children}
        </ThemeContext.Provider>
    );
}


