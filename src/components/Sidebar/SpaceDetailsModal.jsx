import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Users, Mail, Shield, Trash2, LogOut } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
    fetchSpaceMembers,
    inviteSpaceMember,
    updateSpaceMemberRole,
    removeSpaceMember,
    leaveSpace,
    isSpaceOwnerClient,
    updateSpace,
} from '../../services/workspaceService';
import { TEXT } from '@dailyways/limits';
import { RoleSelect } from './BoardDetailsModal';
import './BoardDetailsModal.css';

export default function SpaceDetailsModal({ space, onClose, initialTab = 'details' }) {
    const { state, dispatch, showConfirm } = useApp();
    const { user } = useAuth();
    const currentSpace = useMemo(
        () => state.spaces.find((s) => s.id === space?.id) || space,
        [state.spaces, space]
    );
    const spaceId = currentSpace?.id;
    const ownerId = currentSpace?.ownerId ?? null;
    const isSpaceOwner = isSpaceOwnerClient({ ownerId }, user?.id);

    const [activeTab, setActiveTab] = useState(initialTab);
    const [title, setTitle] = useState(currentSpace?.title || '');
    const [emoji, setEmoji] = useState(currentSpace?.emoji || '🌌');
    const [color, setColor] = useState(currentSpace?.color || null);
    const [saved, setSaved] = useState(false);

    const [members, setMembers] = useState([]);
    const [membersLoading, setMembersLoading] = useState(false);
    const [inviteIdentifier, setInviteIdentifier] = useState('');
    const [inviteRole, setInviteRole] = useState('editor');
    const [shareError, setShareError] = useState('');
    const [shareSuccess, setShareSuccess] = useState('');

    useEffect(() => {
        setTitle(currentSpace?.title || '');
        setEmoji(currentSpace?.emoji || '🌌');
        setColor(currentSpace?.color || null);
    }, [spaceId, currentSpace?.title, currentSpace?.emoji, currentSpace?.color]);

    const loadMembers = async () => {
        if (!spaceId) return;
        setMembersLoading(true);
        setShareError('');
        const { data, error } = await fetchSpaceMembers(spaceId);
        if (error) setShareError(error);
        else setMembers(data || []);
        setMembersLoading(false);
    };

    useEffect(() => {
        if (activeTab === 'share') loadMembers();
    }, [activeTab, spaceId]);

    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const membersWithOwner = useMemo(() => {
        const list = [...members];
        if (ownerId && !list.some((m) => m.userId === ownerId)) {
            list.unshift({
                userId: ownerId,
                role: 'owner',
                name: user?.id === ownerId ? (user?.name || 'Você') : 'Dono',
                username: user?.id === ownerId ? (user?.username || '') : '',
            });
        }
        return list.sort((a, b) => {
            if (a.role === 'owner') return -1;
            if (b.role === 'owner') return 1;
            return (a.name || a.username || '').localeCompare(b.name || b.username || '');
        });
    }, [members, ownerId, user]);

    const canInvite = isSpaceOwner;

    const handleSave = async () => {
        dispatch({
            type: 'UPDATE_SPACE',
            payload: { id: spaceId, updates: { title, emoji, color } },
        });
        await updateSpace(spaceId, { title, emoji, color });
        setSaved(true);
        setTimeout(() => {
            setSaved(false);
            onClose();
        }, 800);
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        if (!canInvite || !spaceId || !inviteIdentifier.trim()) return;
        setShareError('');
        setShareSuccess('');
        const result = await inviteSpaceMember(spaceId, inviteIdentifier.trim(), inviteRole);
        if (!result.success) {
            setShareError(result.error || 'Erro ao enviar convite.');
        } else {
            setShareSuccess('Convite enviado com sucesso.');
            setInviteIdentifier('');
            await loadMembers();
            setTimeout(() => setShareSuccess(''), 2500);
        }
    };

    const handleRoleChange = async (memberUserId, role) => {
        if (!isSpaceOwner) return;
        const result = await updateSpaceMemberRole(spaceId, memberUserId, role);
        if (!result.success) setShareError(result.error || 'Erro ao atualizar permissão.');
        else {
            setShareError('');
            await loadMembers();
        }
    };

    const handleRemoveMember = async (memberUserId) => {
        if (!isSpaceOwner) return;
        const result = await removeSpaceMember(spaceId, memberUserId);
        if (!result.success) setShareError(result.error || 'Erro ao remover membro.');
        else await loadMembers();
    };

    const handleLeaveSpace = async () => {
        const confirmed = await showConfirm({
            title: 'Sair do space',
            message: 'Deixas de ver este space na tua lista.',
            confirmLabel: 'Sair',
            type: 'danger',
        });
        if (!confirmed) return;
        const result = await leaveSpace(spaceId, user.id);
        if (!result.success) {
            setShareError(result.error || 'Erro ao sair do space.');
            return;
        }
        dispatch({ type: 'DELETE_SPACE', payload: spaceId });
        onClose();
    };

    const memberRoleLabel = (role) => {
        switch (role) {
            case 'owner': return 'Dono';
            case 'editor': return 'Editor';
            case 'reader': return 'Leitor';
            default: return role || '—';
        }
    };

    if (!currentSpace?.id) return null;

    return createPortal(
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="board-details-modal animate-scale-in-centered" onClick={(e) => e.stopPropagation()}>
                <div className="board-details-header">
                    <h2>Space</h2>
                    <button type="button" className="btn-icon" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="board-details-tabs">
                    <button
                        type="button"
                        className={`board-details-tab ${activeTab === 'details' ? 'active' : ''}`}
                        onClick={() => setActiveTab('details')}
                    >
                        <Shield size={14} aria-hidden />
                        <span className="board-details-tab-label">Detalhes</span>
                    </button>
                    <button
                        type="button"
                        className={`board-details-tab ${activeTab === 'share' ? 'active' : ''}`}
                        onClick={() => setActiveTab('share')}
                    >
                        <Users size={14} aria-hidden />
                        <span className="board-details-tab-label">Compartilhar</span>
                    </button>
                </div>

                {activeTab === 'details' && (
                    <div className="modal-body">
                        <div className="settings-field">
                            <label>Título</label>
                            <input type="text" value={title} maxLength={TEXT.spaceTitle} onChange={(e) => setTitle(e.target.value)} placeholder="Nome do space" />
                        </div>
                        <div className="settings-field">
                            <label>Emoji</label>
                            <input
                                type="text"
                                value={emoji}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val.length > 0) {
                                        const chars = Array.from(val);
                                        setEmoji(chars[chars.length - 1]);
                                    } else setEmoji('');
                                }}
                                maxLength={10}
                            />
                        </div>
                        <div className="settings-field">
                            <label>Cor</label>
                            <input type="text" value={color || ''} onChange={(e) => setColor(e.target.value || null)} placeholder="#hex ou vazio" />
                        </div>
                    </div>
                )}

                {activeTab === 'share' && (
                    <div className="modal-body">
                        <div className="board-share-panel">
                            {!isSpaceOwner && user && (
                                <div className="board-share-leave-card">
                                    <div className="board-share-leave-text">
                                        <LogOut size={18} className="board-share-leave-icon" aria-hidden />
                                        <div>
                                            <strong>Não és o dono</strong>
                                            <p className="settings-muted board-share-leave-hint">
                                                Podes sair deste space — deixa de aparecer na tua lista.
                                            </p>
                                        </div>
                                    </div>
                                    <button type="button" className="btn btn-ghost btn-sm board-share-leave-btn" onClick={handleLeaveSpace}>
                                        Sair do space
                                    </button>
                                </div>
                            )}

                            {canInvite && (
                                <div className="settings-field board-share-invite-section">
                                    <label>Convidar por @username ou e-mail</label>
                                    <form className="board-share-invite-form" onSubmit={handleInvite}>
                                        <div className="board-share-invite-top">
                                            <div className="board-share-invite-input">
                                                <Mail size={14} />
                                                <input
                                                    type="text"
                                                    placeholder="@username ou email@pessoa.com"
                                                    value={inviteIdentifier}
                                                    onChange={(e) => setInviteIdentifier(e.target.value)}
                                                    autoComplete="off"
                                                />
                                            </div>
                                        </div>
                                        <div className="board-share-invite-bottom">
                                            <RoleSelect
                                                value={inviteRole}
                                                onChange={setInviteRole}
                                                options={[{ value: 'editor', label: 'Editor' }, { value: 'reader', label: 'Leitor' }]}
                                                className="board-share-role-select-invite"
                                            />
                                            <button className="btn btn-primary btn-sm board-share-invite-send" type="submit">
                                                Enviar convite
                                            </button>
                                        </div>
                                    </form>
                                    <p className="settings-field-hint">
                                        Só é possível convidar quem já tem conta no DailyWays.
                                    </p>
                                </div>
                            )}

                            {shareError && <p className="settings-error" style={{ marginTop: 4 }}>{shareError}</p>}
                            {shareSuccess && <p className="settings-success" style={{ marginTop: 4 }}>{shareSuccess}</p>}

                            <div className="settings-field board-share-members-section">
                                <label>Membros do space</label>
                                {membersLoading && <p className="settings-muted">Carregando membros...</p>}
                                {!membersLoading && membersWithOwner.length === 0 && (
                                    <p className="settings-muted">Apenas você tem acesso.</p>
                                )}
                                {!membersLoading && membersWithOwner.map((m) => {
                                    const isRowOwner = m.role === 'owner';
                                    return (
                                        <div key={m.userId} className="board-share-member-row">
                                            <div className="board-share-member-info">
                                                <div className="board-share-avatar">
                                                    <span className="board-share-avatar-fallback">
                                                        {(m.name || m.username || '?')[0]}
                                                    </span>
                                                </div>
                                                <div className="board-share-member-text">
                                                    <div className="board-share-member-name">
                                                        {m.name || m.username || 'Utilizador'}
                                                        {m.username ? <span className="board-share-member-username">@{m.username}</span> : null}
                                                    </div>
                                                    <div className="board-share-member-role">{memberRoleLabel(m.role)}</div>
                                                </div>
                                            </div>
                                            {isSpaceOwner && !isRowOwner && (
                                                <div className="board-share-member-actions">
                                                    <RoleSelect
                                                        value={m.role}
                                                        onChange={(role) => handleRoleChange(m.userId, role)}
                                                        options={[{ value: 'editor', label: 'Editor' }, { value: 'reader', label: 'Leitor' }]}
                                                    />
                                                    <button
                                                        type="button"
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => handleRemoveMember(m.userId)}
                                                        title="Remover"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                <div className="board-details-footer">
                    {activeTab === 'details' && (
                        <button type="button" className="btn btn-primary" onClick={handleSave}>
                            <Save size={16} />
                            {saved ? 'Salvo!' : 'Salvar'}
                        </button>
                    )}
                </div>
            </div>
        </>,
        document.body,
    );
}
