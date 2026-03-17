import { useState, useEffect } from 'react';
import { X, Save, Users, Mail, Shield, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { fetchBoardMembers, inviteBoardMember, updateMemberRole, removeMember } from '../../services/boardService';
import './BoardDetailsModal.css';

export default function BoardDetailsModal({ board, onClose, initialTab = 'details' }) {
    const { updateBoardAndPersist, DEFAULT_BOARD_COLORS } = useApp();
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

    const handleInvite = async (e) => {
        e.preventDefault();
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

    const handleRoleChange = async (userId, role) => {
        const result = await updateMemberRole(board.id, userId, role);
        if (!result.success) {
            setShareError(result.error || 'Erro ao atualizar permissão.');
        } else {
            await loadMembers();
        }
    };

    const handleRemoveMember = async (userId) => {
        const confirm = window.confirm('Remover este membro do board?');
        if (!confirm) return;
        const result = await removeMember(board.id, userId);
        if (!result.success) {
            setShareError(result.error || 'Erro ao remover membro.');
        } else {
            await loadMembers();
        }
    };

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal-content board-details-modal animate-scale-in-centered">
                <div className="modal-header">
                    <h3>Board</h3>
                    <button className="btn-icon" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="board-details-tabs">
                    <button
                        className={`board-details-tab ${activeTab === 'details' ? 'active' : ''}`}
                        onClick={() => setActiveTab('details')}
                    >
                        <Shield size={14} />
                        Detalhes
                    </button>
                    <button
                        className={`board-details-tab ${activeTab === 'share' ? 'active' : ''}`}
                        onClick={() => setActiveTab('share')}
                    >
                        <Users size={14} />
                        Compartilhar
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
                        <div className="settings-field">
                            <label>Convidar por e-mail</label>
                            <form className="board-share-invite-row" onSubmit={handleInvite}>
                                <div className="board-share-invite-input">
                                    <Mail size={14} />
                                    <input
                                        type="email"
                                        placeholder="email@pessoa.com"
                                        value={inviteEmail}
                                        onChange={e => setInviteEmail(e.target.value)}
                                    />
                                </div>
                                <select
                                    value={inviteRole}
                                    onChange={e => setInviteRole(e.target.value)}
                                    className="board-share-role-select"
                                >
                                    <option value="editor">Editor</option>
                                    <option value="reader">Leitor</option>
                                </select>
                                <button className="btn btn-primary btn-sm" type="submit">
                                    Enviar convite
                                </button>
                            </form>
                            <p className="settings-field-hint">
                                A pessoa precisará ter conta com este e-mail para acessar o board.
                            </p>
                        </div>

                        {shareError && <p className="settings-error" style={{ marginTop: 4 }}>{shareError}</p>}
                        {shareSuccess && <p className="settings-success" style={{ marginTop: 4 }}>{shareSuccess}</p>}

                        <div className="settings-field" style={{ marginTop: 16 }}>
                            <label>Membros do board</label>
                            {membersLoading && <p className="settings-muted">Carregando membros...</p>}
                            {!membersLoading && members.length === 0 && (
                                <p className="settings-muted">Apenas você tem acesso a este board.</p>
                            )}
                            {!membersLoading && members.length > 0 && (
                                <div className="board-share-members">
                                    {members.map((m) => (
                                        <div key={m.userId} className="board-share-member-row">
                                            <div className="board-share-member-info">
                                                <div className="board-share-avatar">
                                                    {m.avatar ? (
                                                        <img src={m.avatar} alt={m.name || m.username} />
                                                    ) : (
                                                        <span>{(m.name || m.username || '?')[0]}</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="board-share-name">
                                                        {m.name || m.username || 'Usuário'}
                                                    </div>
                                                    {m.username && (
                                                        <div className="board-share-username">@{m.username}</div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="board-share-member-actions">
                                                <select
                                                    value={m.role}
                                                    onChange={e => handleRoleChange(m.userId, e.target.value)}
                                                    className="board-share-role-select"
                                                >
                                                    <option value="editor">Editor</option>
                                                    <option value="reader">Leitor</option>
                                                </select>
                                                <button
                                                    type="button"
                                                    className="btn-icon"
                                                    title="Remover acesso"
                                                    onClick={() => handleRemoveMember(m.userId)}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
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
        </>
    );
}
