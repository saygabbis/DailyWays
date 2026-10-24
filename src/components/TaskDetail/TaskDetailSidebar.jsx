/** Coluna lateral do modal de tarefa: capa, responsáveis, comentários e atividade. */
import { ImagePlus, ChevronDown, Ban, UserPlus, Trash2, MessageSquare, Plus, Send, History } from 'lucide-react';
import { TEXT } from '@dailyways/limits';
import { initialFromName } from '../../utils/userColor';
import { formatActivityText } from '../../services/activityService';
import { presenceHoverClass, presenceHoverStyle } from '../../hooks/useTaskModalPeerPresence.js';
import { ph } from './taskDetailConstants';

export default function TaskDetailSidebar({ domains, hoverByEl, liveCard, user, coverPanelRef, commentBody, setCommentBody, setCommentFocused }) {
    const {
        showCoverPanel, setShowCoverPanel, imageAttachments, handleSetCover, handleClearCover,
        handleAssignUser, savingAssignee, boardCandidates, assignees, assigneeProfiles, handleRemoveAssignee, loadingDomains,
        visibleComments, handleCreateComment, savingComment, comments, handleDeleteComment, activity,
    } = domains;

    return (
        <aside className="task-detail-sidebar">
            <div className="task-detail-section task-detail-cover-panel" ref={coverPanelRef}>
                <div className="task-detail-section-header">
                    <h3><ImagePlus size={16} /> Capa</h3>
                    <button type="button" {...ph(hoverByEl, 'cover-toggle', 'btn-icon')} onClick={() => setShowCoverPanel((prev) => !prev)}>
                        <ChevronDown size={16} className={showCoverPanel ? 'rotated' : ''} />
                    </button>
                </div>
                {showCoverPanel && (
                    <div className="task-detail-cover-menu">
                        {imageAttachments.length > 0 ? (
                            <>
                                <div className="task-detail-cover-thumbs">
                                    {imageAttachments.map((attachment) => (
                                        <button
                                            key={attachment.id}
                                            type="button"
                                            {...ph(
                                                hoverByEl,
                                                `cover-${attachment.id}`,
                                                `task-detail-cover-thumb ${liveCard.coverAttachmentId === attachment.id ? 'active' : ''}`,
                                            )}
                                            onClick={() => handleSetCover(attachment)}
                                        >
                                            <img src={attachment.publicUrl} alt={attachment.fileName || 'Imagem'} />
                                        </button>
                                    ))}
                                </div>
                                <div className="task-detail-cover-actions-row">
                                    {liveCard.coverAttachmentId && (
                                        <button type="button" {...ph(hoverByEl, 'cover-remove', 'btn btn-secondary btn-sm')} onClick={handleClearCover}>Remover capa</button>
                                    )}
                                    <button type="button" {...ph(hoverByEl, 'cover-clear', 'btn-icon')} title="Sem capa" onClick={handleClearCover}>
                                        <Ban size={16} />
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="task-detail-empty">Envie uma imagem para definir como capa.</div>
                        )}
                    </div>
                )}
            </div>

            <div className="task-detail-section">
                <div className="task-detail-section-header">
                    <h3><UserPlus size={16} /> Responsáveis</h3>
                </div>
                <select
                    className={presenceHoverClass(hoverByEl, 'assignees-select', 'task-detail-select')}
                    style={presenceHoverStyle(hoverByEl, 'assignees-select')}
                    data-presence-hover="assignees-select"
                    onChange={handleAssignUser}
                    disabled={savingAssignee}
                    defaultValue=""
                >
                    <option value="">Adicionar responsável</option>
                    {boardCandidates
                        .filter((candidate) => !assignees.some((item) => item.userId === candidate.userId))
                        .map((candidate) => (
                            <option key={candidate.userId} value={candidate.userId}>
                                {candidate.name || candidate.username || candidate.userId}
                            </option>
                        ))}
                </select>
                <div className="task-detail-assignee-list">
                    {assigneeProfiles.map((assignee) => (
                        <div key={assignee.userId} className="task-detail-assignee-item">
                            <div className="task-detail-assignee-avatar">
                                {assignee.photoUrl ? <img src={assignee.photoUrl} alt={assignee.name} /> : <span>{assignee.avatar}</span>}
                            </div>
                            <div className="task-detail-assignee-meta">
                                <strong>{assignee.name}</strong>
                                <span>{assignee.role || 'membro'}</span>
                            </div>
                            <button type="button" {...ph(hoverByEl, `assignee-remove-${assignee.userId}`, 'btn-icon btn-xs')} onClick={() => handleRemoveAssignee(assignee.userId)}>
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                    {!assigneeProfiles.length && !loadingDomains && <div className="task-detail-empty">Sem responsáveis.</div>}
                </div>
            </div>

            <div className="task-detail-section">
                <div className="task-detail-section-header">
                    <h3><MessageSquare size={16} /> Comentários</h3>
                    <span>{visibleComments.length}</span>
                </div>
                <form className="task-detail-comment-composer" onSubmit={handleCreateComment}>
                    <div className="task-detail-comment-box">
                        <button type="button" className="btn-icon" title="Adicionar">
                            <Plus size={18} />
                        </button>
                        <textarea
                            {...ph(hoverByEl, 'comment-composer', '')}
                            value={commentBody}
                            maxLength={TEXT.cardComment}
                            onChange={(e) => setCommentBody(e.target.value)}
                            onFocus={() => setCommentFocused(true)}
                            onBlur={() => setCommentFocused(false)}
                            placeholder="Digite uma mensagem"
                            rows={1}
                        />
                        <button
                            {...ph(hoverByEl, 'comment-send', 'task-detail-send-btn')}
                            type="submit"
                            disabled={savingComment || !commentBody.trim()}
                            title="Enviar comentário"
                        >
                            <Send size={16} />
                        </button>
                    </div>
                </form>
                <div className="task-detail-comment-list">
                    {comments.map((comment) => {
                        const author = comment.authorId === user?.id
                            ? { name: user?.name || 'Você', photoUrl: user?.photo_url || '', avatar: initialFromName(user?.name || 'V') }
                            : boardCandidates.find((candidate) => candidate.userId === comment.authorId) || null;

                        return (
                            <div key={comment.id} className={`task-detail-comment-item ${comment.deletedAt ? 'deleted' : ''}`}>
                                <div className="task-detail-comment-avatar">
                                    {author?.photoUrl ? <img src={author.photoUrl} alt={author.name} /> : <span>{author?.avatar || initialFromName(author?.name || 'U')}</span>}
                                </div>
                                <div className="task-detail-comment-content">
                                    <div className="task-detail-comment-head">
                                        <strong>{author?.name || 'Usuário'}</strong>
                                        {!comment.deletedAt && <button type="button" className="btn-icon btn-xs" onClick={() => handleDeleteComment(comment.id)}><Trash2 size={12} /></button>}
                                    </div>
                                    <p>{comment.deletedAt ? 'Comentário removido.' : comment.body}</p>
                                </div>
                            </div>
                        );
                    })}
                    {!comments.length && !loadingDomains && <div className="task-detail-empty">Nenhum comentário ainda.</div>}
                </div>
            </div>

            <div className="task-detail-section">
                <div className="task-detail-section-header">
                    <h3><History size={16} /> Atividade</h3>
                    <span>{activity.length}</span>
                </div>
                <div className="task-detail-activity-list">
                    {activity.map((item) => (
                        <div key={item.id} className="task-detail-activity-item">
                            <History size={14} />
                            <span>{formatActivityText(item)}</span>
                        </div>
                    ))}
                    {!activity.length && !loadingDomains && <div className="task-detail-empty">Nenhuma atividade registrada.</div>}
                </div>
            </div>
        </aside>
    );
}
