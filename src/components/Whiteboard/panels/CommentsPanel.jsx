import React, { useState } from 'react';
import { useWhiteboardStore } from '../../stores/whiteboardStore';
import { useAuth } from '../../context/AuthContext';
import { insertComment } from '../../services/whiteboardService';
import { MessageSquare, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import './CommentsPanel.css';

export default function CommentsPanel({ onClose }) {
    const { user } = useAuth();
    const { spaceId, comments, addComment } = useWhiteboardStore();
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!message.trim() || !spaceId || !user?.id) return;
        setSubmitting(true);
        const res = await insertComment(spaceId, { message: message.trim() }, user.id);
        if (res.success && res.id) {
            addComment({
                id: res.id,
                message: message.trim(),
                authorId: user.id,
                createdAt: new Date().toISOString(),
                replies: [],
            });
            setMessage('');
        }
        setSubmitting(false);
    };

    return (
        <div className="comments-panel">
            <div className="comments-panel-header">
                <MessageSquare size={18} />
                <span>Comentários</span>
                <button type="button" className="comments-panel-close" onClick={onClose} title="Fechar">
                    <X size={18} />
                </button>
            </div>
            <form onSubmit={handleSubmit} className="comments-panel-form">
                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Novo comentário..."
                    rows={2}
                    disabled={submitting}
                />
                <button type="submit" disabled={!message.trim() || submitting}>
                    Enviar
                </button>
            </form>
            <ul className="comments-panel-list">
                {comments.map((c) => (
                    <li key={c.id} className="comments-panel-item">
                        <p className="comments-panel-message">{c.message}</p>
                        <span className="comments-panel-meta">
                            {c.createdAt
                                ? formatDistanceToNow(new Date(c.createdAt), { addSuffix: true, locale: ptBR })
                                : ''}
                        </span>
                        {c.replies?.length > 0 && (
                            <ul className="comments-panel-replies">
                                {c.replies.map((r) => (
                                    <li key={r.id}>
                                        <p>{r.message}</p>
                                        <span className="comments-panel-meta">
                                            {r.createdAt
                                                ? formatDistanceToNow(new Date(r.createdAt), {
                                                      addSuffix: true,
                                                      locale: ptBR,
                                                  })
                                                : ''}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}
