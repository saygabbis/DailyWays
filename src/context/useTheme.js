import { createContext, useContext } from 'react';
import { TRANSLATIONS } from './i18n/translations';

export const ThemeContext = createContext(null);

export const useI18n = () => {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useI18n must be used within ThemeProvider');
    return TRANSLATIONS[ctx.language] || TRANSLATIONS['pt-br'];
};

export const useTheme = () => {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
};
