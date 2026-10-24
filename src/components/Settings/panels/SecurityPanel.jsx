import { useState, useEffect, useCallback, memo } from 'react';
import { ShieldCheck, Link2, Unlink } from 'lucide-react';
import { Chrome, Command, Github } from 'lucide-react';
import { ENABLE_MICROSOFT_LOGIN } from '../../../config';

const PROVIDERS = [
    { id: 'google', label: 'Google', icon: Chrome },
    { id: 'github', label: 'GitHub', icon: Github },
    ...(ENABLE_MICROSOFT_LOGIN ? [{ id: 'microsoft', label: 'Microsoft', icon: Command }] : []),
];

// ─────────────────────────────────────────────
// SECURITY PANEL (sem MFA)
// ─────────────────────────────────────────────
const SecurityPanel = memo(function SecurityPanel({ user, getLinkedIdentities, linkIdentity, unlinkIdentity, setPassword, t }) {
    const [identities, setIdentities] = useState([]);
    const [identitiesLoading, setIdentitiesLoading] = useState(false);
    const [linkError, setLinkError] = useState('');
    const [passwordCurrent, setPasswordCurrent] = useState('');
    const [passwordNew, setPasswordNew] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState(false);

    // Load identities once on mount  
    useEffect(() => {
        if (!user) return;
        setIdentitiesLoading(true);
        setLinkError('');
        getLinkedIdentities().then(({ identities: ids }) => {
            setIdentities(ids || []);
            setIdentitiesLoading(false);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // intentionally stable — SecurityPanel mounts only once per tab activation

    const refreshIdentities = useCallback(async () => {
        const { identities: ids } = await getLinkedIdentities();
        setIdentities(ids || []);
    }, [getLinkedIdentities]);

    const hasEmailIdentity = identities.some(i => i.provider === 'email');
    const hasPassword = hasEmailIdentity || user?.has_password;
    const verified = user?.email_confirmed_at && hasEmailIdentity;

    return (
        <div className="settings-panel animate-fade-in">
            <div className="settings-panel-header">
                <h2>{t.secTitle}</h2>
                <p>{t.secSubtitle}</p>
            </div>

            {/* Email login badges */}
            <div className="settings-section">
                <h3 className="settings-section-title">{t.secEmailLogin}</h3>
                <div className="settings-status-badges">
                    {verified && <span className="settings-badge settings-badge-success"><ShieldCheck size={14} /> {t.secEmailVerified}</span>}
                    {hasPassword && <span className="settings-badge settings-badge-success"><ShieldCheck size={14} /> {t.secPasswordLinked}</span>}
                    {!hasPassword && identities.length > 0 && <span className="settings-badge settings-badge-neutral">{t.secNoPasswordHint}</span>}
                    {identities.length === 0 && !user?.email_confirmed_at && <span className="settings-badge settings-badge-warning">Não verificado</span>}
                </div>
            </div>

            {/* Password */}
            <div className="settings-section">
                <h3 className="settings-section-title">{t.secPassword}</h3>
                {!hasPassword ? (
                    <>
                        <p className="settings-section-desc">{t.secSetPasswordDesc}</p>
                        {passwordSuccess && <p className="settings-success">{t.secPasswordSuccess}</p>}
                        {passwordError && <p className="settings-error">{passwordError}</p>}
                        <div className="settings-field">
                            <label>{t.secNewPassword}</label>
                            <input type="password" value={passwordNew} onChange={e => { setPasswordNew(e.target.value); setPasswordError(''); }} placeholder={t.secNewPasswordPh} minLength={6} autoComplete="new-password" />
                        </div>
                        <div className="settings-field">
                            <label>{t.secConfirmPassword}</label>
                            <input type="password" value={passwordConfirm} onChange={e => { setPasswordConfirm(e.target.value); setPasswordError(''); }} placeholder={t.secPasswordPh2} autoComplete="new-password" />
                        </div>
                        <button type="button" className="btn btn-primary btn-sm"
                            disabled={!passwordNew || passwordNew !== passwordConfirm || passwordNew.length < 6}
                            onClick={async () => {
                                setPasswordError(''); setPasswordSuccess(false);
                                if (passwordNew !== passwordConfirm) { setPasswordError('As senhas não coincidem.'); return; }
                                const result = await setPassword(passwordNew);
                                if (result.success) {
                                    setPasswordSuccess(true); setPasswordNew(''); setPasswordConfirm('');
                                    await refreshIdentities();
                                } else { setPasswordError(result.error || 'Erro ao definir senha.'); }
                            }}
                        >{t.secSetPassword}</button>
                    </>
                ) : (
                    <>
                        {passwordSuccess && <p className="settings-success">{t.secPasswordChanged}</p>}
                        {passwordError && <p className="settings-error">{passwordError}</p>}
                        <div className="settings-field">
                            <label>{t.secCurrentPassword}</label>
                            <input type="password" value={passwordCurrent} onChange={e => { setPasswordCurrent(e.target.value); setPasswordError(''); }} placeholder={t.secCurrentPasswordPh} autoComplete="current-password" />
                        </div>
                        <div className="settings-field">
                            <label>{t.secNewPassword}</label>
                            <input type="password" value={passwordNew} onChange={e => { setPasswordNew(e.target.value); setPasswordError(''); }} placeholder={t.secNewPasswordPh} minLength={6} autoComplete="new-password" />
                        </div>
                        <div className="settings-field">
                            <label>{t.secConfirmPasswordNew}</label>
                            <input type="password" value={passwordConfirm} onChange={e => { setPasswordConfirm(e.target.value); setPasswordError(''); }} placeholder={t.secPasswordPh3} autoComplete="new-password" />
                        </div>
                        <button type="button" className="btn btn-primary btn-sm"
                            disabled={!passwordCurrent || !passwordNew || passwordNew !== passwordConfirm || passwordNew.length < 6}
                            onClick={async () => {
                                setPasswordError(''); setPasswordSuccess(false);
                                if (passwordNew !== passwordConfirm) { setPasswordError('As senhas não coincidem.'); return; }
                                const { supabase } = await import('../../../services/supabaseClient');
                                const { error: signInError } = await supabase.auth.signInWithPassword({ email: user?.email, password: passwordCurrent });
                                if (signInError) { setPasswordError('Senha atual incorreta.'); return; }
                                const result = await setPassword(passwordNew);
                                if (result.success) {
                                    setPasswordSuccess(true); setPasswordCurrent(''); setPasswordNew(''); setPasswordConfirm('');
                                } else { setPasswordError(result.error || 'Erro ao alterar senha.'); }
                            }}
                        >{t.secChangePassword}</button>
                    </>
                )}
            </div>

            {/* Linked accounts */}
            <div className="settings-section">
                <h3 className="settings-section-title">{t.secLinkedAccounts}</h3>
                <p className="settings-section-desc">{t.secLinkedDesc}</p>
                {identitiesLoading && <p className="settings-muted">{t.secLoading}</p>}
                {linkError && <p className="settings-error">{linkError}</p>}
                <div className="settings-identities">
                    {PROVIDERS.map(({ id, label, icon: Icon }) => {
                        const linked = identities.find(i => i.provider === (id === 'microsoft' ? 'azure' : id));
                        return (
                            <div key={id} className="settings-identity-row">
                                <Icon size={20} />
                                <span>{label}</span>
                                <span className="settings-identity-status">
                                    {linked ? `${t.secLinked} (${linked.identity_data?.email ?? linked.email ?? '—'})` : t.secNotLinked}
                                </span>
                                {linked ? (
                                    <button type="button" className="btn btn-ghost btn-sm"
                                        onClick={async () => {
                                            const result = await unlinkIdentity(linked);
                                            if (result.success) { await refreshIdentities(); setLinkError(''); }
                                            else setLinkError(result.error || 'Não foi possível desvincular.');
                                        }}
                                    ><Unlink size={14} /> {t.secUnlink}</button>
                                ) : (
                                    <button type="button" className="btn btn-primary btn-sm"
                                        onClick={async () => {
                                            setLinkError('');
                                            const result = await linkIdentity(id);
                                            if (!result.success && result.error) {
                                                const msg = result.error.toLowerCase().includes('manual linking') || result.error.includes('linking is disabled')
                                                    ? 'Vinculação manual está desativada no Supabase. Ative em Authentication > Providers > Identity linking.'
                                                    : result.error;
                                                setLinkError(msg);
                                            }
                                        }}
                                    ><Link2 size={14} /> {t.secLink}</button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
});

export default SecurityPanel;
