import { useState, useEffect, useCallback, memo } from 'react';
import { fetchContacts, fetchContactRequests, respondToContactRequest } from '../../../services/contactsService';
import { fetchBlockedUsers, unblockUser } from '../../../services/privacyService';

// ─────────────────────────────────────────────
// CONTACTS PANEL (settings)
// ─────────────────────────────────────────────
const ContactsPanel = memo(function ContactsPanel({ user }) {
    const userId = user?.id;
    const [loading, setLoading] = useState(true);
    const [contactsCount, setContactsCount] = useState(0);
    const [incoming, setIncoming] = useState([]);
    const [outgoing, setOutgoing] = useState([]);
    const [blocked, setBlocked] = useState([]);
    const [err, setErr] = useState('');

    const refresh = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        setErr('');
        const [{ data: contacts, error: cErr }, { data: reqs, error: rErr }, { data: blocks, error: bErr }] = await Promise.all([
            fetchContacts(),
            fetchContactRequests(),
            fetchBlockedUsers(),
        ]);
        if (cErr || rErr || bErr) setErr(cErr || rErr || bErr || 'Erro ao carregar.');
        setContactsCount((contacts || []).length);
        const inReq = (reqs || []).filter((r) => r.to_user_id === userId && r.status === 'pending');
        const outReq = (reqs || []).filter((r) => r.from_user_id === userId && r.status === 'pending');
        setIncoming(inReq);
        setOutgoing(outReq);
        setBlocked(blocks || []);
        setLoading(false);
    }, [userId]);

    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca dados no Supabase ao montar/trocar a dependência (sincroniza com sistema externo)
    useEffect(() => { refresh(); }, [refresh]);

    const accept = async (id) => {
        const { success, error } = await respondToContactRequest(id, 'accepted');
        if (!success) setErr(error || 'Erro ao aceitar.');
        refresh();
    };
    const decline = async (id) => {
        const { success, error } = await respondToContactRequest(id, 'declined');
        if (!success) setErr(error || 'Erro ao recusar.');
        refresh();
    };
    const unblock = async (blockedUserId) => {
        const { success, error } = await unblockUser(blockedUserId);
        if (!success) setErr(error || 'Erro ao desbloquear.');
        refresh();
    };

    return (
        <div className="settings-panel animate-fade-in">
            <div className="settings-panel-header">
                <h2>Contatos</h2>
                <p>Gerencie solicitações, bloqueios e sua lista de contatos.</p>
            </div>

            {err && <p className="settings-error">{err}</p>}

            <div className="settings-section">
                <h3 className="settings-section-title">Resumo</h3>
                <div className="settings-info-row">
                    <span>Total de contatos</span>
                    <span className="settings-info-value">{loading ? '…' : contactsCount}</span>
                </div>
                <div className="settings-info-row">
                    <span>Solicitações recebidas</span>
                    <span className="settings-info-value">{loading ? '…' : incoming.length}</span>
                </div>
                <div className="settings-info-row">
                    <span>Solicitações enviadas</span>
                    <span className="settings-info-value">{loading ? '…' : outgoing.length}</span>
                </div>
                <div className="settings-info-row">
                    <span>Bloqueados</span>
                    <span className="settings-info-value">{loading ? '…' : blocked.length}</span>
                </div>
            </div>

            <div className="settings-section">
                <h3 className="settings-section-title">Solicitações recebidas</h3>
                {incoming.length === 0 ? (
                    <p className="settings-field-hint">Nenhuma solicitação no momento.</p>
                ) : (
                    incoming.map((r) => (
                        <div key={r.id} className="settings-danger-card">
                            <div>
                                <strong>Solicitação</strong>
                                <p>de {r.from_user_id.slice(0, 8)}…</p>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-primary btn-sm" onClick={() => accept(r.id)}>Aceitar</button>
                                <button className="btn btn-secondary btn-sm" onClick={() => decline(r.id)}>Recusar</button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="settings-section">
                <h3 className="settings-section-title">Bloqueados</h3>
                {blocked.length === 0 ? (
                    <p className="settings-field-hint">Você não bloqueou ninguém.</p>
                ) : (
                    blocked.map((b) => (
                        <div key={b.blocked_user_id} className="settings-danger-card">
                            <div>
                                <strong>{b.blocked_user_id.slice(0, 8)}…</strong>
                                <p>Bloqueado em {b.created_at ? new Date(b.created_at).toLocaleDateString('pt-BR') : ''}</p>
                            </div>
                            <button className="btn btn-secondary btn-sm" onClick={() => unblock(b.blocked_user_id)}>Desbloquear</button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
});

export default ContactsPanel;
