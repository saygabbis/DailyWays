import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { ArrowRight, Lock, Eye, EyeOff } from 'lucide-react';
import './Auth.css';

function parseRecoveryHash() {
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const combinedLower = `${hash || ''}&${search || ''}`.toLowerCase();

    // Só tenta se parecer um link de recovery.
    const looksLikeRecovery =
        combinedLower.includes('type=recovery') ||
        combinedLower.includes('recovery') ||
        combinedLower.includes('reset_password') ||
        combinedLower.includes('reset');

    if (!looksLikeRecovery) return null;

    const hashParams = hash ? new URLSearchParams(hash.replace('#', '?')) : new URLSearchParams();
    const searchParams = search ? new URLSearchParams(search.startsWith('?') ? search : `?${search}`) : new URLSearchParams();

    const token = searchParams.get('token') || hashParams.get('token');
    if (token) return { kind: 'verify', token };

    const access_token = hashParams.get('access_token') || searchParams.get('access_token');
    const refresh_token = hashParams.get('refresh_token') || searchParams.get('refresh_token');
    if (access_token && refresh_token) return { kind: 'session', access_token, refresh_token };

    return null;
}

function getPasswordStrength(pwd) {
    if (!pwd || pwd.length < 8) return 'weak';
    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    const hasNumber = /\d/.test(pwd);
    const hasSpecial = /[^a-zA-Z0-9]/.test(pwd);
    const types = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
    if (types >= 3) return 'strong';
    if (types >= 2) return 'medium';
    return 'weak';
}

export default function PasswordResetPage() {
    const [accessRefresh, setAccessRefresh] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        setAccessRefresh(parseRecoveryHash());
    }, []);

    const redirectTo = useMemo(() => {
        const params = new URLSearchParams(window.location.search || '');
        return params.get('redirect_to') || '/';
    }, []);

    const goBackToMain = () => {
        try {
            window.localStorage.removeItem('dailyways_pw_reset_pending');
            window.localStorage.removeItem('dailyways_pw_reset_pending_ts');
        } catch (_) { }
        // Remove tokens da URL (hash/query) trocando a página/rota.
        window.history.replaceState(null, '', '/');
        window.location.href = '/';
    };

    const canSubmit = useMemo(() => {
        if (!accessRefresh) return false;
        if (loading) return false;
        if (!newPassword || newPassword.length < 6) return false;
        if (newPassword !== confirmPassword) return false;
        return true;
    }, [accessRefresh, loading, newPassword, confirmPassword]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        if (!accessRefresh) {
            setError('Link de recuperação inválido ou expirado. Tente novamente.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('As senhas não conferem.');
            return;
        }
        if (!newPassword || newPassword.length < 6) {
            setError('A senha deve ter no mínimo 6 caracteres.');
            return;
        }

        setLoading(true);
        try {
            if (accessRefresh.kind === 'verify') {
                const { error: verifyErr } = await supabase.auth.verifyOtp({
                    type: 'recovery',
                    token: accessRefresh.token,
                });
                if (verifyErr) throw verifyErr;

                // Em alguns casos, garantir que temos sessão antes de atualizar usuário.
                const { data: sessionData } = await supabase.auth.getSession();
                if (sessionData?.session?.access_token && sessionData?.session?.refresh_token) {
                    await supabase.auth.setSession({
                        access_token: sessionData.session.access_token,
                        refresh_token: sessionData.session.refresh_token,
                    });
                }
            } else if (accessRefresh.kind === 'session') {
                await supabase.auth.setSession({
                    access_token: accessRefresh.access_token,
                    refresh_token: accessRefresh.refresh_token,
                });
            }

            const { error: updateErr } = await supabase.auth.updateUser({
                password: newPassword,
            });
            if (updateErr) throw updateErr;

            setSuccess('Senha atualizada com sucesso. Entrando...');

            // Limpa flag de reset forçado
            window.localStorage.removeItem('dailyways_pw_reset_pending');
            window.localStorage.removeItem('dailyways_pw_reset_pending_ts');
            // Limpa URL (remove query token) e redireciona
            window.history.replaceState(null, '', redirectTo);
            // Fallback caso o history não gere reload suficiente em alguns navegadores
            setTimeout(() => {
                window.location.href = redirectTo;
            }, 50);
        } catch (err) {
            setError(err?.message || 'Falha ao atualizar senha. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    const strength = getPasswordStrength(newPassword);
    const strengthLabel = strength === 'weak' ? 'fraca' : strength === 'medium' ? 'média' : 'forte';

    return (
        <div className="auth-page">
            <div className="auth-bg">
                <div className="auth-orb-wrapper auth-orb-1"><div className="auth-orb auth-orb-1" /></div>
                <div className="auth-orb-wrapper auth-orb-2"><div className="auth-orb auth-orb-2" /></div>
                <div className="auth-orb-wrapper auth-orb-3"><div className="auth-orb auth-orb-3" /></div>
            </div>
            <div className="auth-container animate-scale-in">
                <div className="auth-header">
                    <div className="auth-logo" style={{ marginBottom: 'var(--space-sm)' }}>
                        <Lock size={26} style={{ color: 'var(--accent-primary)' }} />
                        <span className="auth-logo-name" style={{ fontSize: '1.25rem' }}>
                            Redefinir senha
                        </span>
                    </div>
                    <p className="auth-subtitle">
                        Digite a nova senha para continuar.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    {!accessRefresh && (
                        <div className="auth-error auth-error-inline" role="alert">
                            Link de recuperação inválido ou expirado. Tente novamente.
                        </div>
                    )}
                    <div className="auth-field animate-slide-up">
                        <div className="auth-password-wrap">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Nova senha"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value.replace(/\s/g, ''))}
                                required
                                minLength={6}
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                className="auth-password-toggle"
                                onClick={() => setShowPassword(v => !v)}
                                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        {newPassword && (
                            <div className="auth-password-strength" data-strength={strength}>
                                <span className="auth-password-strength-label">
                                    Senha {strengthLabel}
                                </span>
                                <span className="auth-password-strength-bars">
                                    <span /><span /><span />
                                </span>
                            </div>
                        )}
                        {newPassword && getPasswordStrength(newPassword) === 'weak' && (
                            <div className="auth-error auth-error-inline" role="status" aria-live="polite" style={{ background: 'transparent' }}>
                                Sua senha parece fraca. Você pode deixá-la mais forte, mas não é obrigatório.
                            </div>
                        )}
                    </div>

                    <div className="auth-field animate-slide-up auth-field-delay-1">
                        <input
                            type="password"
                            placeholder="Confirmar senha"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value.replace(/\s/g, ''))}
                            required
                            minLength={6}
                            autoComplete="new-password"
                        />
                    </div>

                    {!!confirmPassword && newPassword !== confirmPassword && (
                        <div className="auth-error auth-error-inline" role="alert">
                            As senhas não são iguais.
                        </div>
                    )}

                    {(error || success) && (
                        <div className="auth-error" role={success ? 'status' : 'alert'}>
                            {error || success}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary auth-submit"
                        disabled={!canSubmit}
                    >
                        {loading ? 'Atualizando...' : <>Atualizar senha <ArrowRight size={18} /></>}
                    </button>

                    <button
                        type="button"
                        className="btn btn-secondary auth-submit"
                        onClick={goBackToMain}
                    >
                        Voltar para a página principal
                    </button>
                </form>
            </div>
        </div>
    );
}

