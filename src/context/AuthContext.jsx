import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';

const AuthContext = createContext(null);

function buildUserData(authUser, profile) {
  if (!authUser) return null;
  const name = profile?.name ?? authUser.user_metadata?.name ?? authUser.email?.split('@')[0] ?? 'Usuário';
  const avatar = profile?.avatar ?? name.charAt(0).toUpperCase();
  return {
    id: authUser.id,
    email: authUser.email,
    email_confirmed_at: authUser.email_confirmed_at,
    name,
    username: profile?.username ?? authUser.user_metadata?.username ?? null,
    avatar,
    bio: profile?.bio ?? '',
    has_password: profile?.has_password ?? false,
  };
}

async function ensureProfile(authUser) {
  if (!authUser?.id) return null;
  const { data: existing } = await supabase.from('profiles').select('*').eq('id', authUser.id).single();
  if (existing) return existing;
  const username = authUser.user_metadata?.username ?? `user_${authUser.id.slice(0, 8)}`;
  const name = authUser.user_metadata?.name ?? authUser.email?.split('@')[0] ?? 'Usuário';
  const { data: inserted, error } = await supabase.from('profiles').insert({
    id: authUser.id,
    username,
    name,
    avatar: name.charAt(0).toUpperCase(),
    updated_at: new Date().toISOString(),
  }).select().single();
  if (error) {
    if (error.code === '23505') return (await supabase.from('profiles').select('*').eq('id', authUser.id).single()).data;
    console.error('ensureProfile error', error);
    return null;
  }
  return inserted;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mfaChallengeId, setMfaChallengeId] = useState(null);
  const [authError, setAuthError] = useState('');

  const refreshUser = useCallback(async (authUser) => {
    if (!authUser) {
      setUser(null);
      setProfile(null);
      return;
    }
    const prof = await ensureProfile(authUser);
    setProfile(prof);
    setUser(buildUserData(authUser, prof));
  }, []);

  const loadSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) await refreshUser(session.user);
  }, [refreshUser]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted && session?.user) await refreshUser(session.user);
      if (mounted) setLoading(false);
    })();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, { session }) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setMfaChallengeId(null);
        return;
      }
      if (session?.user) await refreshUser(session.user);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [refreshUser]);

  const login = async (identifier, password) => {
    setLoading(true);
    try {
      let email = identifier;
      if (!identifier.includes('@')) {
        const { data, error } = await supabase.rpc('get_email_by_username', { u: identifier });
        if (error || !data) {
          setLoading(false);
          setAuthError('Usuário não encontrado.');
          return { success: false, error: 'Usuário não encontrado.' };
        }
        email = data;
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const msg = error.message?.includes('Email not confirmed')
          ? 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.'
          : error.message?.includes('Invalid login')
            ? 'E-mail ou senha incorretos.'
            : error.message || 'Erro ao entrar.';
        setLoading(false);
        setAuthError(msg);
        return { success: false, error: msg };
      }
      if (data?.session?.aal === 'aal2') {
        setLoading(false);
        return { success: true };
      }
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.[0];
      if (totp?.status === 'verified') {
        const { data: challenge } = await supabase.auth.mfa.challenge({ factorId: totp.id });
        if (challenge?.id) {
          setMfaChallengeId(challenge.id);
          setLoading(false);
          return { success: false, requiresMfa: true, error: null };
        }
      }
      await refreshUser(data.user);
      setLoading(false);
      return { success: true };
    } catch (e) {
      setLoading(false);
      const msg = e?.message || 'Erro ao entrar.';
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  const verifyMfa = async (code) => {
    if (!mfaChallengeId) return { success: false, error: 'Sessão de verificação expirada.' };
    const { data, error } = await supabase.auth.mfa.verify({ challengeId: mfaChallengeId, code });
    setMfaChallengeId(null);
    if (error) return { success: false, error: error.message || 'Código inválido.' };
    await refreshUser(data.user);
    return { success: true };
  };

  const loginWithProvider = async (provider) => {
    const map = { google: 'google', github: 'github', microsoft: 'azure' };
    const supabaseProvider = map[provider] || provider;
    const options = {
      redirectTo: window.location.origin,
      queryParams: {},
    };
    if (supabaseProvider === 'azure') {
      options.scopes = 'email openid profile';
    }
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: supabaseProvider,
      options,
    });
    if (error) return { success: false, error: error.message };
    if (data?.url) {
      const target = window.self !== window.top ? window.top : window;
      try {
        target.location.replace(data.url);
      } catch (e) {
        try { window.location.replace(data.url); } catch (e2) {}
      }
      return { success: true, redirecting: true };
    }
    return { success: false, error: 'Redirecionamento não disponível.' };
  };

  const register = async (name, username, email, password) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, username },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        setLoading(false);
        const raw = error.message || '';
        const msg = raw.includes('already registered')
          ? 'Este e-mail já está cadastrado.'
          : /rate limit|rate_limit/i.test(raw)
            ? 'Limite de envio de e-mails do servidor atingido. Aguarde alguns minutos e tente de novo, ou configure SMTP no Supabase (veja SUPABASE_SETUP.md).'
            : raw || 'Erro ao criar conta.';
        setAuthError(msg);
        return { success: false, error: msg };
      }
      // Conta criada; sem sessão = precisa confirmar e-mail (sempre mostrar tela "Conta criada")
      if (data?.user && !data?.session) {
        setLoading(false);
        setAuthError('');
        return { success: true, pendingEmailConfirmation: true };
      }
      // Com sessão = conta criada e já logado; não atualizar user aqui para a UI mostrar "Conta criada! Redirecionando..."
      if (data?.user && data?.session) {
        setLoading(false);
        setAuthError('');
        return { success: true, hasSession: true };
      }
      setLoading(false);
      const fallbackMsg = 'Não foi possível criar a conta. Tente novamente.';
      setAuthError(fallbackMsg);
      return { success: false, error: fallbackMsg };
    } catch (e) {
      setLoading(false);
      const msg = e?.message || 'Erro ao criar conta.';
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (_) {}
    setUser(null);
    setProfile(null);
    setMfaChallengeId(null);
    setAuthError('');
  };

  const confirmLogout = () => {
    if (window.confirm('Tem certeza que deseja sair da conta?')) {
      logout();
    }
  };

  const updateProfile = async (updates) => {
    if (!user?.id) return { success: false, error: 'Não autenticado.' };
    const { error } = await supabase.from('profiles').update({
      ...updates,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id);
    if (error) return { success: false, error: error.message };
    setProfile((p) => ({ ...p, ...updates }));
    setUser((u) => (u ? { ...u, ...updates } : null));
    return { success: true };
  };

  const startMfaEnrollment = async () => {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'DailyWays',
    });
    if (error) return { success: false, error: error.message, data: null };
    return {
      success: true,
      data: {
        id: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      },
    };
  };

  const verifyMfaEnrollment = async (factorId, code) => {
    const { data, error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  };

  const disableMfa = async () => {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totp = factors?.totp?.[0];
    if (!totp) return { success: false, error: '2FA não está ativo.' };
    const { error } = await supabase.auth.mfa.unenroll({ factorId: totp.id });
    if (error) return { success: false, error: error.message };
    return { success: true };
  };

  const getLinkedIdentities = async () => {
    const { data, error } = await supabase.auth.getUserIdentities();
    if (error) return { identities: [], error: error.message };
    return { identities: data?.identities ?? [] };
  };

  const linkIdentity = async (provider) => {
    const map = { google: 'google', github: 'github', microsoft: 'azure' };
    const supabaseProvider = map[provider] || provider;
    const options = { redirectTo: window.location.origin };
    if (supabaseProvider === 'azure') options.scopes = 'email openid profile';
    const { data, error } = await supabase.auth.linkIdentity({
      provider: supabaseProvider,
      options,
    });
    if (error) return { success: false, error: error.message };
    if (data?.url) {
      window.location.href = data.url;
      return { success: true };
    }
    return { success: false, error: 'Redirecionamento não disponível.' };
  };

  const unlinkIdentity = async (identity) => {
    const { error } = await supabase.auth.unlinkIdentity(identity);
    if (error) return { success: false, error: error.message };
    return { success: true };
  };

  const setPassword = async (newPassword) => {
    const { data: { user: u }, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, error: error.message };
    if (u?.id) {
      await supabase.from('profiles').update({ has_password: true, updated_at: new Date().toISOString() }).eq('id', u.id);
      await refreshUser(u);
    }
    return { success: true };
  };

  const value = {
    user,
    profile,
    loading,
    mfaChallengeId,
    authError,
    clearAuthError: () => setAuthError(''),
    login,
    verifyMfa,
    register,
    logout,
    confirmLogout,
    updateProfile,
    loginWithProvider,
    startMfaEnrollment,
    verifyMfaEnrollment,
    disableMfa,
    getLinkedIdentities,
    linkIdentity,
    unlinkIdentity,
    setPassword,
    refreshUser,
    loadSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
