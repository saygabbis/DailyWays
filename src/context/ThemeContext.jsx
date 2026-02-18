import { createContext, useContext, useState, useEffect } from 'react';
import storageService from '../services/storageService';

const ThemeContext = createContext(null);

const ACCENT_PRESETS = [
    { id: 'purple', name: 'Roxo', color: '#7c3aed', secondary: '#6d28d9' },
    { id: 'blue', name: 'Azul', color: '#3b82f6', secondary: '#2563eb' },
    { id: 'green', name: 'Verde', color: '#10b981', secondary: '#059669' },
    { id: 'rose', name: 'Rosa', color: '#f43f5e', secondary: '#e11d48' },
    { id: 'orange', name: 'Laranja', color: '#f97316', secondary: '#ea580c' },
    { id: 'teal', name: 'Turquesa', color: '#14b8a6', secondary: '#0d9488' },
    { id: 'indigo', name: 'Índigo', color: '#6366f1', secondary: '#4f46e5' },
    { id: 'amber', name: 'Âmbar', color: '#f59e0b', secondary: '#d97706' },
];

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        return storageService.load('dailyways_theme') || 'light';
    });

    const [accentId, setAccentId] = useState(() => {
        return storageService.load('dailyways_accent') || 'purple';
    });

    const accent = ACCENT_PRESETS.find(a => a.id === accentId) || ACCENT_PRESETS[0];

    // Apply theme + accent to DOM
    useEffect(() => {
        const root = document.documentElement;
        root.setAttribute('data-theme', theme);
        storageService.save('dailyways_theme', theme);
    }, [theme]);

    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty('--accent-primary', accent.color);
        root.style.setProperty('--accent-secondary', accent.secondary);
        root.style.setProperty('--accent-gradient', `linear-gradient(135deg, ${accent.color} 0%, ${accent.secondary} 100%)`);
        root.style.setProperty('--accent-gradient-hover', `linear-gradient(135deg, ${accent.color}dd 0%, ${accent.color} 100%)`);
        root.style.setProperty('--accent-glow', `0 4px 16px ${accent.color}40`);

        // Light-specific accent derivatives
        if (document.documentElement.getAttribute('data-theme') === 'light') {
            root.style.setProperty('--accent-light', `${accent.color}18`);
            root.style.setProperty('--bg-hover', `${accent.color}0d`);
            root.style.setProperty('--bg-active', `${accent.color}1a`);
            root.style.setProperty('--glass-border', `${accent.color}1a`);
        } else {
            root.style.setProperty('--accent-light', `${accent.color}26`);
            root.style.setProperty('--bg-hover', `${accent.color}14`);
            root.style.setProperty('--bg-active', `${accent.color}26`);
            root.style.setProperty('--glass-border', `${accent.color}1f`);
        }

        storageService.save('dailyways_accent', accentId);
    }, [accent, accentId, theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    const setAccent = (id) => {
        setAccentId(id);
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, accentId, setAccent, accent, ACCENT_PRESETS }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
};
