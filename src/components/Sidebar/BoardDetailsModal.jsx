import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Users, Mail, Shield, Trash2, ChevronDown, LogOut, Star } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { fetchBoardMembers, inviteBoardMember, updateMemberRole, removeMember, isBoardOwnerClient, sortBoardMembersOwnerFirst } from '../../services/boardService';
import './BoardDetailsModal.css';

function RoleSelect({ value, onChange, options, className = '', disabled = false }) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const onDown = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('pointerdown', onDown);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('pointerdown', onDown);
        };
    }, [open]);

    const selectedLabel = options.find(o => o.value === value)?.label ?? value;

    return (
        <div className={`board-share-role-select-wrap ${className}`} ref={wrapRef}>
            <button
                type="button"
                className="board-share-role-select-btn"
                onClick={() => {
                    if (disabled) return;
                    setOpen(v => !v);
                }}
                aria-expanded={open}
                disabled={disabled}
            >
                <span className="board-share-role-select-label">{selectedLabel}</span>
                <ChevronDown size={16} className={`board-share-role-select-chevron ${open ? 'open' : ''}`} />
            </button>
            {open && !disabled && (
                <div className="board-share-role-menu" role="menu">
                    {options.map((o) => (
                        <button
                            key={o.value}
                            type="button"
                            className={`board-share-role-menu-item ${o.value === value ? 'active' : ''}`}
                            onClick={() => {
                                onChange(o.value);
                                setOpen(false);
                            }}
                            role="menuitem"
                        >
                            {o.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function BoardDetailsModal({ board, onClose, initialTab = 'details' }) {
    const { updateBoardAndPersist, DEFAULT_BOARD_COLORS, showConfirm, reloadBoards } = useApp();
    const { user } = useAuth();
    const isBoardOwner = isBoardOwnerClient(board, user?.id);
    const [activeTab, setActiveTab] = useState(initialTab);

    // Detalhes
    const [title, setTitle] = useState(board.title);
    const [emoji, setEmoji] = useState(board.emoji);
    const [color, setColor] = useState(board.color);
    const [saved, setSaved] = useState(false);

    // Compartilhar
    const [members, setMembers] = useState([]);
    const [membersLoading, setMembersLoading] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('editor');
    const [shareError, setShareError] = useState('');
    const [shareSuccess, setShareSuccess] = useState('');

    const handleSave = async () => {
        await updateBoardAndPersist(board.id, { title, emoji, color });
        setSaved(true);
        setTimeout(() => {
            setSaved(false);
            onClose();
        }, 1000);
    };

    const loadMembers = async () => {
        setMembersLoading(true);
        setShareError('');
        const { data, error } = await fetchBoardMembers(board.id);
        if (error) {
            setShareError(error);
        } else {
            setMembers(data || []);
        }
        setMembersLoading(false);
    };

    useEffect(() => {
        if (activeTab === 'share') {
            loadMembers();
        }
    }, [activeTab]);

    // Close on Escape
    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const membersSorted = useMemo(
        () => sortBoardMembersOwnerFirst(members, board.ownerId),
        [members, board.ownerId]
    );

    const myMembership = members.find((m) => m.userId === user?.id);
    const myRole = myMembership?.role;
    const canManageMembers = isBoardOwner || myRole === 'admin';
    const canInvite = isBoardOwner;

    const memberRoleLabel = (role) => {
        switch (role) {
            case 'owner': return 'Dono';
            case 'admin': return 'Administrador';
            case 'editor': return 'Editor';
            case 'reader': return 'Leitor';
            default: return role || '—';
        }
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        if (!canInvite) return;
        if (!inviteEmail.trim()) return;
        setShareError('');
        setShareSuccess('');
        const result = await inviteBoardMember(board.id, inviteEmail.trim(), inviteRole);
        if (!result.success) {
            setShareError(result.error || 'Erro ao enviar convite.');
        } else {
            setShareSuccess('Convite enviado com sucesso.');
            setInviteEmail('');
            await loadMembers();
            setTimeout(() => setShareSuccess(''), 2500);
        }
    };

    const handleRoleChange = async (memberUserId, role) => {
        if (!canManageMembers) return;
        if (myRole === 'admin' && (role === 'admin' || role === 'owner')) {
            setShareError('Só o dono do board pode definir administradores.');
            return;
        }
        const result = await updateMemberRole(board.id, memberUserId, role);
        if (!result.success) {
            setShareError(result.error || 'Erro ao atualizar permissão.');
        } else {
            setShareError('');
            await loadMembers();
        }
    };

    const handleToggleAdmin = async (m) => {
        if (!isBoardOwner || m.role === 'owner' || board.ownerId === m.userId) return;
        const makeAdmin = m.role !== 'admin';
        const name = m.name || m.username || 'este utilizador';
        const confirmed = await showConfirm({
            title: makeAdmin ? 'Tornar administrador' : 'Remover administrador',
            message: makeAdmin
                ? `Tornar ${name} administrador de «${board.title}»? Poderá alterar funções (editor/leitor) e remover membros, exceto o dono.`
                : `Remover o papel de administrador de ${name}? Volta a ser editor.`,
            confirmLabel: makeAdmin ? 'Tornar administrador' : 'Remover',
            cancelLabel: 'Cancelar',
            type: makeAdmin ? 'info' : 'danger',
        });
        if (!confirmed) return;
        const result = await updateMemberRole(board.id, m.userId, makeAdmin ? 'admin' : 'editor');
        if (!result.success) {
            setShareError(result.error || 'Erro ao atualizar.');
        } else {
            setShareError('');
            await loadMembers();
        }
    };

    const handleLeaveBoard = async () => {
        if (!user?.id) return;
        const confirmed = await showConfirm({
            title: 'Sair do board',
            message: 'Vais deixar de ver este board na tua lista. O dono e os outros membros mantêm o board.',
            confirmLabel: 'Sair',
            cancelLabel: 'Cancelar',
            type: 'danger',
        });
        if (!confirmed) return;
        const result = await removeMember(board.id, user.id);
        if (!result.success) {
            setShareError(result.error || 'Erro ao sair do board.');
            return;
        }
        setShareError('');
        await reloadBoards();
        onClose();
    };

    const handleRemoveMember = async (memberUserId) => {
        const isSelf = memberUserId === user?.id;
        const confirmed = await showConfirm({
            title: isSelf ? 'Sair do board' : 'Remover membro',
            message: isSelf
                ? 'Vais deixar de ver este board na tua lista.'
                : 'Esta pessoa perde o acesso a este board.',
            confirmLabel: isSelf ? 'Sair' : 'Remover',
            cancelLabel: 'Cancelar',
            type: 'danger',
        });
        if (!confirmed) return;
        const result = await removeMember(board.id, memberUserId);
        if (!result.success) {
            setShareError(result.error || 'Erro ao remover membro.');
        } else {
            if (isSelf) {
                await reloadBoards();
                onClose();
            } else {
                await loadMembers();
            }
        }
    };

    return createPortal(
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal-content board-details-modal animate-scale-in-centered">
                <div className="modal-header">
                    <h3>Board</h3>
                    <button className="btn-icon" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="board-details-tabs">
                    <button
                        type="button"
                        className={`board-details-tab ${activeTab === 'details' ? 'active' : ''}`}
                        onClick={() => setActiveTab('details')}
                        aria-label="Detalhes do board"
                        title="Detalhes"
                    >
                        <Shield size={14} aria-hidden />
                        <span className="board-details-tab-label">Detalhes</span>
                    </button>
                    <button
                        type="button"
                        className={`board-details-tab ${activeTab === 'share' ? 'active' : ''}`}
                        onClick={() => setActiveTab('share')}
                        aria-label="Compartilhar board"
                        title="Compartilhar"
                    >
                        <Users size={14} aria-hidden />
                        <span className="board-details-tab-label">Compartilhar</span>
                    </button>
                </div>

                {activeTab === 'details' && (
                    <div className="modal-body">
                        <div className="settings-field">
                            <label>Título</label>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="Nome do board"
                            />
                        </div>

                        <div className="settings-field">
                            <label>Emoji</label>
                            <input
                                type="text"
                                value={emoji}
                                onChange={e => {
                                    const val = e.target.value;
                                    if (val.length > 0) {
                                        const chars = Array.from(val);
                                        setEmoji(chars[chars.length - 1]);
                                    } else {
                                        setEmoji('');
                                    }
                                }}
                                placeholder="🚀"
                                maxLength={10}
                            />
                            <p className="settings-field-hint">O novo emoji substituirá o atual automaticamente.</p>
                        </div>

                        <div className="settings-field">
                            <label>Cor do Board</label>
                            <div className="settings-accent-grid">
                                {DEFAULT_BOARD_COLORS.map((c, i) => (
                                    <button
                                        key={i}
                                        className={`settings-accent-btn ${color === c ? 'active' : ''} ${c === null ? 'settings-accent-none' : ''}`}
                                        onClick={() => setColor(c)}
                                        style={c ? { background: c } : {}}
                                    >
                                        {c === null ? (
                                            <span className="settings-accent-none-label">—</span>
                                        ) : (
                                            color === c && <div className="active-check">✓</div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                        </div>
                )}

                {activeTab === 'share' && (
                    <div className="modal-body">
                        <div className="board-share-panel">
                            {!isBoardOwner && user && (
                                <div className="board-share-leave-card">
                                    <div className="board-share-leave-text">
                                        <LogOut size={18} className="board-share-leave-icon" aria-hidden />
                                        <div>
                                            <strong>Não és o dono</strong>
                                            <p className="settings-muted board-share-leave-hint">
                                                Podes sair deste board — deixa de aparecer na tua lista e removes-te dos membros.
                                            </p>
                                        </div>
                                    </div>
                                    <button type="button" className="btn btn-ghost btn-sm board-share-leave-btn" onClick={handleLeaveBoard}>
                                        Sair do board
                                    </button>
                                </div>
                            )}

                            {canInvite && (
                            <div className="settings-field board-share-invite-section">
                                <label>Convidar por e-mail</label>
                                <form className="board-share-invite-form" onSubmit={handleInvite}>
                                    <div className="board-share-invite-top">
                                        <div className="board-share-invite-input">
                                            <Mail size={14} />
                                            <input
                                                type="email"
                                                placeholder="email@pessoa.com"
                                                value={inviteEmail}
                                                onChange={e => setInviteEmail(e.target.value)}
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
                                    A pessoa precisará ter conta com este e-mail para acessar o board.
                                </p>
                            </div>
                            )}

                            {shareError && <p className="settings-error" style={{ marginTop: 4 }}>{shareError}</p>}
                            {shareSuccess && <p className="settings-success" style={{ marginTop: 4 }}>{shareSuccess}</p>}

                            <div className="settings-field board-share-members-section">
                                <label>Membros do board</label>
                            {membersLoading && <p className="settings-muted">Carregando membros...</p>}
                            {!membersLoading && members.length === 0 && (
                                <p className="settings-muted">Apenas você tem acesso a este board.</p>
                            )}
                            {!membersLoading && members.length > 0 && (
                                <div className="board-share-members board-share-members-card">
                                    {membersSorted.map((m) => {
                                        const isRowOwner = m.role === 'owner' || board.ownerId === m.userId;
                                        const showAdminStar = isBoardOwner && !isRowOwner && m.userId !== user?.id;
                                        const showEditorReaderSelect = canManageMembers && !isRowOwner && m.role !== 'admin';
                                        const showAdminDemoteForCoAdmin = canManageMembers && !isRowOwner && m.role === 'admin' && !isBoardOwner;
                                        const showReadonlyRoleLabel = isRowOwner || !canManageMembers
                                            || (m.role === 'admin' && isBoardOwner);
                                        const canRemoveOrLeave = m.role !== 'owner' && (
                                            m.userId === user?.id
                                            || (canManageMembers && board.ownerId !== m.userId)
                                        );
                                        return (
                                        <div key={m.userId} className="board-share-member-row">
                                            <div className="board-share-member-info">
                                                {showAdminStar && (
                                                    <button
                                                        type="button"
                                                        className={`board-share-admin-star ${m.role === 'admin' ? 'is-admin' : ''}`}
                                                        title={m.role === 'admin' ? 'Remover como administrador' : 'Tornar administrador'}
                                                        aria-label={m.role === 'admin' ? 'Remover administrador' : 'Tornar administrador'}
                                                        onClick={() => handleToggleAdmin(m)}
                                                    >
                                                        <Star size={15} strokeWidth={2} />
                                                    </button>
                                                )}
                                                <div className="board-share-avatar">
                                                    {m.photoUrl ? (
                                                        <>
                                                            <img
                                                                src={m.photoUrl}
                                                                alt={m.name || m.username}
                                                                className="board-share-avatar-img"
                                                                onError={(e) => {
                                                                    const img = e.currentTarget;
                                                                    const wrap = img.closest('.board-share-avatar');
                                                                    const fallback = wrap?.querySelector('.board-share-avatar-fallback');
                                                                    if (fallback) {
                                                                        fallback.style.display = 'flex';
                                                                    }
                                                                    img.style.display = 'none';
                                                                }}
                                                            />
                                                            <span className="board-share-avatar-fallback hidden">
                                                                {(m.name || m.username || '?')[0]}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="board-share-avatar-fallback">
                                                            {(m.name || m.username || '?')[0]}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="board-share-member-text">
                                                    <div
                                                        className="board-share-name"
                                                        title={m.name || m.username || 'Usuário'}
                                                    >
                                                        {m.name || m.username || 'Usuário'}
                                                    </div>
                                                    {m.username && (
                                                        <div className="board-share-username" title={`@${m.username}`}>
                                                            @{m.username}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="board-share-member-actions">
                                                {showEditorReaderSelect && (
                                                    <RoleSelect
                                                        value={m.role}
                                                        onChange={(val) => handleRoleChange(m.userId, val)}
                                                        options={[{ value: 'editor', label: 'Editor' }, { value: 'reader', label: 'Leitor' }]}
                                                        className="board-share-role-select-member"
                                                    />
                                                )}
                                                {showAdminDemoteForCoAdmin && (
                                                    <div className="board-share-admin-demote">
                                                        <span className="board-share-role-readonly">Administrador</span>
                                                        <button type="button" className="btn btn-ghost btn-xs" onClick={() => handleRoleChange(m.userId, 'editor')}>
                                                            Editor
                                                        </button>
                                                        <button type="button" className="btn btn-ghost btn-xs" onClick={() => handleRoleChange(m.userId, 'reader')}>
                                                            Leitor
                                                        </button>
                                                    </div>
                                                )}
                                                {showReadonlyRoleLabel && (
                                                    <span className="board-share-role-readonly">{memberRoleLabel(m.role)}</span>
                                                )}
                                                {canRemoveOrLeave && (
                                                    <button
                                                        type="button"
                                                        className="btn-icon"
                                                        title={m.userId === user?.id ? 'Sair do board' : 'Remover acesso'}
                                                        onClick={() => handleRemoveMember(m.userId)}
                                                    >
                                                        {m.userId === user?.id ? <LogOut size={14} /> : <Trash2 size={14} />}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                )}

                {activeTab === 'details' && (
                    <div className="modal-footer">
                        <button className="btn btn-primary" onClick={handleSave}>
                            <Save size={16} />
                            {saved ? 'Salvo!' : 'Salvar Alterações'}
                        </button>
                    </div>
                )}
            </div>
        </>,
        document.body
    );
}
