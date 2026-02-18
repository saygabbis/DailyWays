import { createContext, useContext, useState, useEffect } from 'react';
import storageService, { STORAGE_KEYS } from '../services/storageService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const saved = storageService.load(STORAGE_KEYS.USER);
        if (saved) setUser(saved);
        setLoading(false);
    }, []);

    const login = (email, password) => {
        const users = storageService.load('dailyways_users') || [];
        const found = users.find(u => u.email === email && u.password === password);
        if (!found) return { success: false, error: 'Email ou senha incorretos' };
        const userData = { id: found.id, name: found.name, email: found.email, avatar: found.avatar };
        setUser(userData);
        storageService.save(STORAGE_KEYS.USER, userData);
        return { success: true };
    };

    const loginWithProvider = (provider) => {
        const mockUsers = {
            google: { id: 'google-1', name: 'Google User', email: 'user@gmail.com', avatar: 'G' },
            microsoft: { id: 'ms-1', name: 'Microsoft User', email: 'user@outlook.com', avatar: 'M' },
            github: { id: 'gh-1', name: 'GitHub User', email: 'user@github.com', avatar: 'GH' }
        };

        const userData = mockUsers[provider];
        if (userData) {
            setUser(userData);
            storageService.save(STORAGE_KEYS.USER, userData);
            return { success: true };
        }
        return { success: false, error: 'Provider not supported' };
    };

    const register = (name, email, password) => {
        const users = storageService.load('dailyways_users') || [];
        if (users.find(u => u.email === email)) {
            return { success: false, error: 'Email já cadastrado' };
        }
        const newUser = {
            id: crypto.randomUUID(),
            name,
            email,
            password,
            avatar: name.charAt(0).toUpperCase(),
            createdAt: new Date().toISOString(),
        };
        users.push(newUser);
        storageService.save('dailyways_users', users);
        const userData = { id: newUser.id, name: newUser.name, email: newUser.email, avatar: newUser.avatar };
        setUser(userData);
        storageService.save(STORAGE_KEYS.USER, userData);
        return { success: true };
    };

    const logout = () => {
        setUser(null);
        storageService.remove(STORAGE_KEYS.USER);
    };

    const updateProfile = (updates) => {
        const updated = { ...user, ...updates };
        setUser(updated);
        storageService.save(STORAGE_KEYS.USER, updated);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile, loginWithProvider }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};
