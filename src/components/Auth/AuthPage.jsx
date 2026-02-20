import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { ENABLE_MICROSOFT_LOGIN } from '../../config';
import { Lock, Mail, User, ArrowRight, Chrome, Command, Github, Shield } from 'lucide-react';
import logoImg from '../../assets/Logo - Branco.png';
import './Auth.css';

function getOAuthErrorFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash ? new URLSearchParams(window.location.hash.replace('#', '?')) : null;
  const error = params.get('error') || hash?.get('error');
  const desc = params.get('error_description') || hash?.get('error_description');
  if (error) return desc ? `${error}: ${decodeURIComponent(desc)}` : error;
  return null;
}

export default function AuthPage() {
  const {
    login,
    register,
    verifySignupOtp,
    loginWithProvider,
    verifyMfa,
    loadSession,
    loading: authLoading,
    authError: contextAuthError,
    clearAuthError,
  } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingEmailConfirmation, setPendingEmailConfirmation] = useState(false);
  const [showAccountCreatedRedirecting, setShowAccountCreatedRedirecting] = useState(false);
  const [showMfaStep, setShowMfaStep] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const errorRef = useRef(null);
  const otpInputRef = useRef(null);

  useEffect(() => {
    const oauthError = getOAuthErrorFromUrl();
    if (oauthError) {
      const hint = oauthError.includes('server_error') || oauthError.includes('exchange')
        ? ' Verifique SUPABASE_SETUP.md: URL Configuration (Redirect URLs) e Azure (Redirect URI + Client secret).'
        : '';
      setError(oauthError + hint);
      window.history.replaceState({}, '', window.location.pathname || '/');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    clearAuthError();
    setLoading(true);
    try {
      if (showMfaStep) {
        const result = await verifyMfa(mfaCode);
        if (result.success) return;
        setError(result.error || 'Código inválido.');
        setLoading(false);
        return;
      }
      if (isLogin) {
        const result = await login(identifier.trim(), password);
        if (result.success) return;
        if (result.requiresMfa) {
          setShowMfaStep(true);
          setError('');
        } else {
          setError(result.error || 'Erro ao entrar.');
        }
      } else {
        if (!name.trim()) {
          setError('Nome é obrigatório');
          setLoading(false);
          return;
        }
        if (!username.trim()) {
          setError('Username é obrigatório');
          setLoading(false);
          return;
        }
        if (!email.trim()) {
          setError('E-mail é obrigatório');
          setLoading(false);
          return;
        }
        if (!password || password.length < 6) {
          setError('Senha deve ter no mínimo 6 caracteres');
          setLoading(false);
          return;
        }
        let result;
        try {
          result = await register(name.trim(), username.trim(), email.trim(), password);
        } catch (err) {
          setError(err?.message || 'Erro ao criar conta. Tente novamente.');
          setLoading(false);
          return;
        }
        if (result?.success && result.pendingEmailConfirmation) {
          console.log('[AuthPage] OTP modal: abrindo para', email.trim());
          setOtpEmail(email.trim());
          setOtpCode('');
          setOtpError('');
          setShowOtpModal(true);
          setError('');
        } else if (result?.success && result.hasSession) {
          setShowAccountCreatedRedirecting(true);
          setError('');
        } else if (result?.success) {
          return;
        } else {
          setError(result?.error || 'Erro ao criar conta.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider) => {
    setError('');
    setLoading(true);
    const result = await loginWithProvider(provider);
    if (result.redirecting) return;
    setLoading(false);
    if (!result.success && result.error) setError(result.error);
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setError('');
    clearAuthError();
    setShowAccountCreatedRedirecting(false);
    setShowMfaStep(false);
    setMfaCode('');
    setShowOtpModal(false);
    setOtpCode('');
    setOtpError('');
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length < 6) return;
    setOtpLoading(true);
    setOtpError('');
    const result = await verifySignupOtp(otpEmail, otpCode);
    setOtpLoading(false);
    if (result.success) {
      setShowOtpModal(false);
    } else {
      setOtpError(result.error || 'Código inválido.');
    }
  };

  const cancelOtp = () => {
    setShowOtpModal(false);
    setOtpCode('');
    setOtpError('');
  };

  useEffect(() => {
    if (!showAccountCreatedRedirecting) return;
    const t = setTimeout(() => {
      loadSession().then(() => setShowAccountCreatedRedirecting(false));
    }, 1800);
    return () => clearTimeout(t);
  }, [showAccountCreatedRedirecting, loadSession]);

  const displayError = error || contextAuthError;
  useEffect(() => {
    if (displayError && errorRef.current) errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [displayError]);

  const backFromMfa = () => {
    setShowMfaStep(false);
    setMfaCode('');
    setError('');
  };

  // Focus OTP input when modal opens
  useEffect(() => {
    if (showOtpModal && otpInputRef.current) {
      setTimeout(() => otpInputRef.current?.focus(), 100);
    }
  }, [showOtpModal]);

  if (showAccountCreatedRedirecting) {
    return (
      <div className="auth-page">
        <div className="auth-bg">
          <div className="auth-orb auth-orb-1" />
          <div className="auth-orb auth-orb-2" />
          <div className="auth-orb auth-orb-3" />
        </div>
        <div className="auth-container auth-container-success animate-scale-in">
          <div className="auth-header">
            <div className="auth-logo">
              <img src={logoImg} alt="DailyWays" className="auth-logo-img" />
              <span className="auth-logo-name">DailyWays</span>
            </div>
            <h1 className="auth-success-title">Conta criada!</h1>
            <p className="auth-subtitle">Redirecionando você para o app…</p>
          </div>
          <div className="auth-confirm-msg auth-confirm-msg-box">
            <p>Você já está logado. Em instantes você será redirecionado.</p>
          </div>
          <div className="auth-success-spinner" aria-hidden />
        </div>
      </div>
    );
  }

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
            <img src={logoImg} alt="DailyWays" className="auth-logo-img" />
            <span className="auth-logo-name">DailyWays</span>
          </div>
          <p className="auth-subtitle">
            {showMfaStep
              ? 'Digite o código do seu aplicativo autenticador'
              : isLogin
                ? 'Bem-vindo de volta! 👋'
                : 'Crie sua conta gratuita ✨'}
          </p>
        </div>

        {showMfaStep ? (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <Shield size={18} className="auth-field-icon" />
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="000000"
                value={mfaCode}
                onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                autoComplete="one-time-code"
              />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button type="submit" className="btn btn-primary auth-submit" disabled={loading || mfaCode.length < 6}>
              {loading ? <span className="auth-spinner" /> : <>Verificar e entrar <ArrowRight size={18} /></>}
            </button>
            <button type="button" className="auth-switch-btn" onClick={backFromMfa}>
              Voltar
            </button>
          </form>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="auth-form">
              {!isLogin && (
                <>
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
                  <div className="auth-field animate-slide-up">
                    <User size={18} className="auth-field-icon" />
                    <input
                      type="text"
                      placeholder="Username (único)"
                      value={username}
                      onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                      autoComplete="username"
                    />
                  </div>
                </>
              )}

              {isLogin ? (
                <div className="auth-field">
                  <Mail size={18} className="auth-field-icon" />
                  <input
                    type="text"
                    placeholder="E-mail ou username"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    required
                    autoComplete="username email"
                  />
                </div>
              ) : (
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
              )}

              <div className="auth-field">
                <Lock size={18} className="auth-field-icon" />
                <input
                  type="password"
                  placeholder="Senha"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                />
              </div>

              {(error || contextAuthError) && (
                <div ref={errorRef} className="auth-error" role="alert">
                  {error || contextAuthError}
                </div>
              )}

              <button type="submit" className="btn btn-primary auth-submit" disabled={loading || authLoading}>
                {loading || authLoading ? (
                  <span className="auth-spinner" />
                ) : (
                  <>
                    {isLogin ? 'Entrar' : 'Criar Conta'}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            <button type="button" onClick={switchMode} className="auth-switch-btn">
              {isLogin ? 'Criar conta' : 'Fazer login'}
            </button>

            <div className="auth-separator">
              <span>ou continue com</span>
            </div>

            <div className="auth-social-row">
              <button
                type="button"
                className="btn-social-icon google"
                onClick={() => handleSocialLogin('google')}
                title="Google"
                disabled={loading}
              >
                <Chrome size={20} />
              </button>
              {ENABLE_MICROSOFT_LOGIN && (
                <button
                  type="button"
                  className="btn-social-icon microsoft"
                  onClick={() => handleSocialLogin('microsoft')}
                  title="Microsoft"
                  disabled={loading}
                >
                  <Command size={20} />
                </button>
              )}
              <button
                type="button"
                className="btn-social-icon github"
                onClick={() => handleSocialLogin('github')}
                title="GitHub"
                disabled={loading}
              >
                <Github size={20} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* OTP Verification Modal — Portal no body para escapar do overflow:hidden do auth-page */}
      {showOtpModal && createPortal(
        <div className="otp-overlay" onClick={cancelOtp}>
          <div className="otp-modal animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="otp-modal-header">
              <Mail size={28} className="otp-icon" />
              <h2>Verifique seu e-mail</h2>
              <p>Enviamos um código de 6 dígitos para <strong>{otpEmail}</strong></p>
            </div>
            <div className="otp-modal-body">
              <input
                ref={otpInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="000000"
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                className="otp-input"
                autoComplete="one-time-code"
                onKeyDown={e => { if (e.key === 'Enter' && otpCode.length === 6) handleVerifyOtp(); }}
              />
              {otpError && <div className="otp-error">{otpError}</div>}
              <p className="otp-hint">O código expira em 5 minutos. Confira também o spam.</p>
            </div>
            <div className="otp-modal-actions">
              <button
                type="button"
                className="btn btn-primary otp-verify-btn"
                onClick={handleVerifyOtp}
                disabled={otpLoading || otpCode.length < 6}
              >
                {otpLoading ? <span className="auth-spinner" /> : 'Verificar e Logar'}
              </button>
              <button type="button" className="otp-cancel-btn" onClick={cancelOtp}>
                Cancelar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
