import { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { X, UserPlus, Copy, Check } from 'lucide-react';
import './ShareModal.css';

export default function ShareModal({ onClose, boardTitle }) {
    const { addToast } = useToast();
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('editor');
    const [copied, setCopied] = useState(false);
    const [members, setMembers] = useState([
        { id: 1, name: 'Você', email: 'voce@exemplo.com', role: 'owner', avatar: 'Me' },
        { id: 2, name: 'Alice Silva', email: 'alice@exemplo.com', role: 'editor', avatar: 'AS' },
        { id: 3, name: 'Bob Jones', email: 'bob@exemplo.com', role: 'viewer', avatar: 'BJ' },
    ]);

    const handleInvite = (e) => {
        e.preventDefault();
        if (!email.trim()) return;
        setMembers([...members, {
            id: Date.now(),
            name: email.split('@')[0],
            email,
            role,
            avatar: email.charAt(0).toUpperCase()
        }]);
        addToast(`Convite enviado para ${email}`, 'success');
        setEmail('');
    };

    const copyLink = () => {
        navigator.clipboard.writeText(`https://dailyways.app/board/share/${Date.now()}`);
        setCopied(true);
        addToast('Link copiado para a área de transferência', 'success');
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="share-modal animate-scale-in-centered">
                <div className="share-header">
                    <h2>Compartilhar "{boardTitle}"</h2>
                    <button className="btn-icon" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="share-body">
                    <form onSubmit={handleInvite} className="share-invite-form">
                        <input
                            type="email"
                            placeholder="Endereço de email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="share-input"
                        />
                        <select
                            value={role}
                            onChange={e => setRole(e.target.value)}
                            className="share-select"
                        >
                            <option value="editor">Editor</option>
                            <option value="viewer">Visualizador</option>
                        </select>
                        <button type="submit" className="btn btn-primary" disabled={!email.trim()}>
                            Convidar
                        </button>
                    </form>

                    <div className="share-link-section">
                        <div className="share-link-text">
                            <span className="share-link-icon">🔗</span>
                            <span>Qualquer pessoa com o link pode visualizar</span>
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={copyLink}>
                            {copied ? <Check size={14} /> : <Copy size={14} />}
                            {copied ? 'Copiado!' : 'Copiar Link'}
                        </button>
                    </div>

                    <div className="share-members">
                        <h3>Membros do Board</h3>
                        <div className="members-list">
                            {members.map(member => (
                                <div key={member.id} className="member-item">
                                    <div className="member-avatar">{member.avatar}</div>
                                    <div className="member-info">
                                        <div className="member-name">
                                            {member.name} {member.role === 'owner' && '(Você)'}
                                        </div>
                                        <div className="member-email">{member.email}</div>
                                    </div>
                                    <div className="member-role">
                                        {member.role === 'owner' ? 'Dono' : (
                                            <select defaultValue={member.role} className="role-select-sm">
                                                <option value="editor">Editor</option>
                                                <option value="viewer">Visualizador</option>
                                            </select>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
