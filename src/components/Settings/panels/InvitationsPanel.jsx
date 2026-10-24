import { useState, useEffect, useCallback, memo } from 'react';
import { useApp } from '../../../context/AppContext';
import {
    fetchMyInvitations,
    fetchMyInvitationHistory,
    clearMyInvitationHistory,
    acceptInvitation,
    declineInvitation,
} from '../../../services/boardService';
import '../Settings.css';
import '../AvatarCropper.css';

// ─────────────────────────────────────────────
// INVITATIONS PANEL
// ─────────────────────────────────────────────
function formatInviteDate(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return '—';
    }
}

const InvitationsPanel = memo(function InvitationsPanel() {
    const { reloadBoards } = useApp();
    const [loadingPending, setLoadingPending] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [clearingHistory, setClearingHistory] = useState(false);
    const [error, setError] = useState('');
    const [pending, setPending] = useState([]);
    const [history, setHistory] = useState([]);

    const load = useCallback(async () => {
        setError('');
        setLoadingPending(true);
        setLoadingHistory(true);

        const [pendingRes, historyRes] = await Promise.all([
            fetchMyInvitations(),
            fetchMyInvitationHistory({ limit: 100 }),
        ]);

        if (pendingRes.error) setError(pendingRes.error);
        else if (historyRes.error && !pendingRes.error) setError(historyRes.error);

        setPending(pendingRes.data || []);
        setHistory(historyRes.data || []);
        setLoadingPending(false);
        setLoadingHistory(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleAccept = async (inv) => {
        setError('');
        const res = await acceptInvitation(inv.id, inv.kind || 'board');
        if (!res.success) {
            setError(res.error || 'Erro ao aceitar convite.');
        } else {
            await load();
            if (inv.kind === 'space') {
                window.location.reload();
            } else {
                await reloadBoards();
            }
        }
    };

    const handleDecline = async (inv) => {
        setError('');
        const res = await declineInvitation(inv.id, inv.kind || 'board');
        if (!res.success) {
            setError(res.error || 'Erro ao recusar convite.');
        } else {
            await load();
        }
    };

    const handleClearHistory = async () => {
        if (!window.confirm('Limpar todo o histórico de convites? Esta ação não pode ser desfeita.')) {
            return;
        }
        setError('');
        setClearingHistory(true);
        const res = await clearMyInvitationHistory();
        setClearingHistory(false);
        if (!res.success) {
            setError(res.error || 'Erro ao limpar histórico.');
            return;
        }
        await load();
    };

    return (
        <div className="settings-panel animate-fade-in">
            <div className="settings-panel-header">
                <h2>Convites</h2>
                <p>Convites para boards e spaces compartilhados com você.</p>
            </div>

            {error && <p className="settings-error">{error}</p>}

            <div className="settings-section">
                <h3 className="settings-section-title">Pendentes</h3>
                <p className="settings-section-desc">
                    Convites à espera da tua resposta.
                </p>
                {loadingPending && <p className="settings-muted">Carregando...</p>}
                {!loadingPending && pending.length === 0 && (
                    <p className="settings-muted">Não tens convites pendentes.</p>
                )}
                {!loadingPending && pending.length > 0 && (
                    <div className="settings-invitations-list">
                        {pending.map((inv) => (
                            <div key={inv.id} className="settings-invitation-row">
                                <div className="settings-invitation-main">
                                    <div className="settings-invitation-emoji">
                                        {inv.kind === 'space' ? (inv.spaceEmoji || '🌌') : (inv.boardEmoji || '📋')}
                                    </div>
                                    <div className="settings-invitation-text">
                                        <div className="settings-invitation-title">
                                            {inv.kind === 'space' ? inv.spaceTitle : inv.boardTitle}
                                        </div>
                                        <div className="settings-invitation-meta">
                                            {inv.kind === 'space' ? 'Space' : 'Board'}
                                            {' · '}
                                            {inv.role === 'editor' ? 'Editor' : 'Leitor'}
                                            {inv.inviterLabel ? ` · por ${inv.inviterLabel}` : ''}
                                        </div>
                                    </div>
                                </div>
                                <div className="settings-invitation-actions">
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => handleDecline(inv)}
                                    >
                                        Recusar
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        onClick={() => handleAccept(inv)}
                                    >
                                        Aceitar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="settings-section">
                <div className="settings-section-head">
                    <h3 className="settings-section-title">Histórico</h3>
                    {!loadingHistory && history.length > 0 && (
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm settings-clear-history-btn"
                            onClick={handleClearHistory}
                            disabled={clearingHistory}
                        >
                            {clearingHistory ? 'A limpar...' : 'Limpar histórico'}
                        </button>
                    )}
                </div>
                <p className="settings-section-desc">
                    Registo de convites que aceitaste ou recusaste.
                </p>
                {loadingHistory && <p className="settings-muted">Carregando histórico...</p>}
                {!loadingHistory && history.length === 0 && (
                    <p className="settings-muted">Ainda não há entradas no histórico.</p>
                )}
                {!loadingHistory && history.length > 0 && (
                    <div className="settings-invitations-history-scroll">
                        <ul className="settings-invitations-history">
                            {history.map((inv) => (
                                <li key={`${inv.kind}-${inv.id}`} className="settings-invitation-history-row">
                                    <div className="settings-invitation-history-main">
                                        <span className="settings-invitation-emoji" aria-hidden>
                                            {inv.kind === 'space' ? (inv.spaceEmoji || '🌌') : (inv.boardEmoji || '📋')}
                                        </span>
                                        <div className="settings-invitation-text">
                                            <div className="settings-invitation-title">
                                                {inv.kind === 'space' ? inv.spaceTitle : inv.boardTitle}
                                            </div>
                                            <div className="settings-invitation-meta">
                                                {inv.kind === 'space' ? 'Space' : 'Board'}
                                                {' · '}
                                                {inv.role === 'editor' ? 'Editor' : 'Leitor'}
                                                {inv.inviterLabel ? ` · ${inv.inviterLabel}` : ''}
                                            </div>
                                            <div className="settings-invitation-date">
                                                {formatInviteDate(inv.createdAt)}
                                            </div>
                                        </div>
                                    </div>
                                    <span
                                        className={`settings-invitation-status settings-invitation-status--${inv.status}`}
                                    >
                                        {inv.status === 'accepted' ? 'Aceite' : 'Recusado'}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
});

export default InvitationsPanel;
