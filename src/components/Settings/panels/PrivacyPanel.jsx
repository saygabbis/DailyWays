import { useState, useEffect, memo } from 'react';
import { Save, Shield, Bell, ShieldCheck } from 'lucide-react';
import { fetchPrivacySettings, updatePrivacySettings, fetchBlockedUsersWithProfiles, unblockUser } from '../../../services/privacyService';

const PRIVACY_ALLOW_OPTIONS = [
    { id: 'everyone', label: 'Todos' },
    { id: 'contacts_only', label: 'Apenas contatos' },
    { id: 'no_one', label: 'Ninguém' },
];

/** Quem você bloqueou (veio da antiga aba Contatos das Configurações). */
function BlockedUsersSection() {
    const [blocked, setBlocked] = useState(null);
    const [err, setErr] = useState('');
    const load = async () => {
        const { data, error } = await fetchBlockedUsersWithProfiles();
        if (error) setErr(error);
        setBlocked(data || []);
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca no Supabase ao montar
    useEffect(() => { load(); }, []);
    const unblock = async (id) => {
        const { success, error } = await unblockUser(id);
        if (!success) setErr(error || 'Erro ao desbloquear.');
        load();
    };
    return (
        <div className="settings-section">
            <h3 className="settings-section-title">Bloqueados</h3>
            {err && <p className="settings-error">{err}</p>}
            {blocked === null && <p className="settings-muted">Carregando…</p>}
            {blocked?.length === 0 && <p className="settings-field-hint">Você não bloqueou ninguém.</p>}
            {blocked?.map((b) => (
                <div key={b.blocked_user_id} className="settings-danger-card">
                    <div>
                        <strong>{b.profile?.name || b.profile?.username || 'Usuário'}</strong>
                        <p>
                            {b.profile?.username ? `@${b.profile.username} · ` : ''}
                            bloqueado em {b.created_at ? new Date(b.created_at).toLocaleDateString('pt-BR') : '—'}
                        </p>
                    </div>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => unblock(b.blocked_user_id)}>Desbloquear</button>
                </div>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────
// PRIVACY PANEL
// ─────────────────────────────────────────────
const PrivacyPanel = memo(function PrivacyPanel({ user }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');
    const [saved, setSaved] = useState(false);

    const [settings, setSettings] = useState({
        allow_contact_requests: 'everyone',
        discoverable_by_email: true,
        discoverable_by_username: true,
        allow_dm_from: 'everyone',
        show_online_status: true,
        read_receipts: true,
    });

    useEffect(() => {
        if (!user?.id) return;
        (async () => {
            setLoading(true);
            setErr('');
            const { data, error } = await fetchPrivacySettings();
            if (error) setErr(error);
            setSettings((prev) => ({ ...prev, ...(data || {}) }));
            setLoading(false);
        })();
    }, [user?.id]);

    const toggle = (key) => setSettings((prev) => ({ ...prev, [key]: !prev[key] }));

    const save = async () => {
        setSaving(true);
        setErr('');
        const { success, error } = await updatePrivacySettings(settings);
        setSaving(false);
        if (!success) {
            setErr(error || 'Erro ao salvar.');
            return;
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
    };

    return (
        <div className="settings-panel animate-fade-in">
            <div className="settings-panel-header">
                <h2>Privacidade</h2>
                <p>Controle quem pode te encontrar e quem pode te mandar DM.</p>
            </div>

            {err && <p className="settings-error">{err}</p>}

            <div className="settings-section">
                <h3 className="settings-section-title">Descoberta</h3>

                <div className="settings-toggle-row">
                    <div className="settings-toggle-info">
                        <Shield size={18} />
                        <div>
                            <strong>Descobrir por email</strong>
                            <p>Permite que encontrem você ao digitar seu email no autocomplete.</p>
                        </div>
                    </div>
                    <div className={`settings-toggle ${settings.discoverable_by_email ? 'active' : ''}`} onClick={() => toggle('discoverable_by_email')}>
                        <div className="settings-toggle-thumb" />
                    </div>
                </div>

                <div className="settings-toggle-row">
                    <div className="settings-toggle-info">
                        <Shield size={18} />
                        <div>
                            <strong>Descobrir por @username</strong>
                            <p>Permite aparecer em buscas por username.</p>
                        </div>
                    </div>
                    <div className={`settings-toggle ${settings.discoverable_by_username ? 'active' : ''}`} onClick={() => toggle('discoverable_by_username')}>
                        <div className="settings-toggle-thumb" />
                    </div>
                </div>
            </div>

            <div className="settings-section">
                <h3 className="settings-section-title">Solicitações de contato</h3>
                <div className="settings-field">
                    <label>Quem pode mandar solicitação</label>
                    <select
                        value={settings.allow_contact_requests}
                        onChange={(e) => setSettings((prev) => ({ ...prev, allow_contact_requests: e.target.value }))}
                        disabled={loading}
                        className="settings-select"
                    >
                        {PRIVACY_ALLOW_OPTIONS.map((o) => (
                            <option key={o.id} value={o.id}>{o.label}</option>
                        ))}
                    </select>
                    <p className="settings-field-hint">Se “Ninguém”, você só pode iniciar conversas buscando pessoas e elas precisam permitir DM.</p>
                </div>
            </div>

            <div className="settings-section">
                <h3 className="settings-section-title">Mensagens (DM)</h3>
                <div className="settings-field">
                    <label>Quem pode te mandar DM</label>
                    <select
                        value={settings.allow_dm_from}
                        onChange={(e) => setSettings((prev) => ({ ...prev, allow_dm_from: e.target.value }))}
                        disabled={loading}
                        className="settings-select"
                    >
                        {PRIVACY_ALLOW_OPTIONS.filter((o) => o.id !== 'no_one').map((o) => (
                            <option key={o.id} value={o.id}>{o.label}</option>
                        ))}
                    </select>
                    <p className="settings-field-hint">“Apenas contatos” exige que a pessoa esteja na sua lista de contatos.</p>
                </div>

                <div className="settings-toggle-row">
                    <div className="settings-toggle-info">
                        <Bell size={18} />
                        <div>
                            <strong>Status online</strong>
                            <p>Permite exibir/ocultar sua presença quando estiver usando o app.</p>
                        </div>
                    </div>
                    <div className={`settings-toggle ${settings.show_online_status ? 'active' : ''}`} onClick={() => toggle('show_online_status')}>
                        <div className="settings-toggle-thumb" />
                    </div>
                </div>

                <div className="settings-toggle-row">
                    <div className="settings-toggle-info">
                        <ShieldCheck size={18} />
                        <div>
                            <strong>Confirmação de leitura</strong>
                            <p>Quando desligado, o outro não vê confirmação de leitura (✓✓ azul).</p>
                        </div>
                    </div>
                    <div className={`settings-toggle ${settings.read_receipts ? 'active' : ''}`} onClick={() => toggle('read_receipts')}>
                        <div className="settings-toggle-thumb" />
                    </div>
                </div>
            </div>

            <div className="settings-actions">
                <button className="btn btn-primary" onClick={save} disabled={saving || loading}>
                    <Save size={16} />
                    {saved ? 'Salvo' : (saving ? 'Salvando…' : 'Salvar')}
                </button>
            </div>

            <BlockedUsersSection />
        </div>
    );
});

export default PrivacyPanel;
