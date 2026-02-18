import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Lock, Mail, User, ArrowRight, Sparkles, Chrome, Command, Github } from 'lucide-react';
import './Auth.css';

export default function AuthPage() {
    const { login, register, loginWithProvider } = useAuth();
    const { addToast } = useToast();
    const [isLogin, setIsLogin] = useState(true);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        setTimeout(() => {
            let result;
            if (isLogin) {
                result = login(email, password);
            } else {
                if (!name.trim()) { setError('Nome é obrigatório'); setLoading(false); return; }
                result = register(name, email, password);
            }
            if (!result.success) setError(result.error);
            setLoading(false);
        }, 600);
    };

    const switchMode = () => {
        setIsLogin(!isLogin);
        setError('');
    };

    return (
        <div className="auth-page">
            <div className="auth-bg">
                <div className="auth-orb auth-orb-1" />
                <div className="auth-orb auth-orb-2" />
                <div className="auth-orb auth-orb-3" />
            </div>

            <div className="auth-container animate-scale-in">
                <div className="auth-header">
                    <div className="auth-logo">
                        <Sparkles size={32} />
                        <span>DailyWays</span>
                    </div>
                    <p className="auth-subtitle">
                        {isLogin ? 'Bem-vindo de volta! 👋' : 'Crie sua conta gratuita ✨'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    {!isLogin && (
                        <div className="auth-field animate-slide-up">
                            <User size={18} className="auth-field-icon" />
                            <input
                                type="text"
                                placeholder="Seu nome"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                autoComplete="name"
                            />
                        </div>
                    )}

                    <div className="auth-field">
                        <Mail size={18} className="auth-field-icon" />
                        <input
                            type="email"
                            placeholder="seu@email.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div className="auth-field">
                        <Lock size={18} className="auth-field-icon" />
                        <input
                            type="password"
                            placeholder="Senha"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            minLength={4}
                            autoComplete={isLogin ? 'current-password' : 'new-password'}
                        />
                    </div>

                    {error && <div className="auth-error">{error}</div>}

                    <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                        {loading ? (
                            <span className="auth-spinner" />
                        ) : (
                            <>
                                {isLogin ? 'Entrar' : 'Criar Conta'}
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>
                </form>

                <button onClick={switchMode} className="auth-switch-btn">
                    {isLogin ? 'Criar conta' : 'Fazer login'}
                </button>


                <div className="auth-separator">
                    <span>ou continue com</span>
                </div>

                <div className="auth-social-row">
                    <button className="btn-social-icon google" onClick={() => loginWithProvider('google')} title="Google">
                        <Chrome size={20} />
                    </button>
                    <button className="btn-social-icon microsoft" onClick={() => loginWithProvider('microsoft')} title="Microsoft">
                        <Command size={20} />
                    </button>
                    <button className="btn-social-icon github" onClick={() => loginWithProvider('github')} title="GitHub">
                        <Github size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
}
