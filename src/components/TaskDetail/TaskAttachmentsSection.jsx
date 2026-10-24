/** Seção de anexos do modal de tarefa (lista, edição de nome/descrição, download, remoção, links). */
import { Paperclip, Link as LinkIcon, Download, Edit3, Trash2, Upload } from 'lucide-react';
import { TEXT } from '@dailyways/limits';

export default function TaskAttachmentsSection({ domains, fileInputRef }) {
    const {
        attachments, showLinkForm, handleAddLink, linkUrl, setLinkUrl, linkLabel, setLinkLabel,
        attachmentDrafts, setAttachmentDrafts, editingAttachmentId, setEditingAttachmentId,
        handleAttachmentDraftChange, handleSaveAttachmentMeta, handleRemoveAttachment,
        loadingDomains, uploading, attachmentError,
    } = domains;

    return (
        <div className="task-detail-section">
            <div className="task-detail-section-header">
                <h3><Paperclip size={16} /> Anexos</h3>
                <span>{attachments.length}</span>
            </div>

            {showLinkForm && (
                <form className="task-detail-link-form" onSubmit={handleAddLink}>
                    <input value={linkUrl} maxLength={TEXT.linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." />
                    <input value={linkLabel} maxLength={TEXT.linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Nome opcional" />
                    <button className="btn btn-primary btn-sm" type="submit">Salvar link</button>
                </form>
            )}

            <div className="task-detail-attachments-grid task-detail-attachments-list">
                {attachments.map((attachment) => {
                    const draft = attachmentDrafts[attachment.id] || {};
                    const isEditing = editingAttachmentId === attachment.id;
                    return (
                        <div key={attachment.id} className="task-detail-attachment-row">
                            {attachment.kind === 'image' && attachment.publicUrl ? (
                                <img src={attachment.publicUrl} alt={attachment.fileName || 'Imagem'} className="task-detail-attachment-thumb" />
                            ) : (
                                <div className="task-detail-attachment-placeholder">
                                    {attachment.kind === 'link' ? <LinkIcon size={18} /> : <Paperclip size={18} />}
                                </div>
                            )}

                            <div className="task-detail-attachment-info">
                                {isEditing ? (
                                    <>
                                        <input
                                            className="task-detail-inline-input"
                                            value={draft.fileName ?? attachment.fileName ?? ''}
                                            onChange={(e) => handleAttachmentDraftChange(attachment.id, 'fileName', e.target.value)}
                                            placeholder="Nome do anexo"
                                        />
                                        <input
                                            className="task-detail-inline-input"
                                            value={draft.description ?? attachment.description ?? ''}
                                            onChange={(e) => handleAttachmentDraftChange(attachment.id, 'description', e.target.value)}
                                            placeholder="Descrição"
                                        />
                                        <div className="task-detail-inline-actions">
                                            <button type="button" className="btn btn-primary btn-xs" onClick={() => handleSaveAttachmentMeta(attachment)}>Salvar</button>
                                            <button type="button" className="btn btn-secondary btn-xs" onClick={() => setEditingAttachmentId(null)}>Cancelar</button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <strong>{attachment.fileName || attachment.linkLabel || 'Anexo'}</strong>
                                        <span>{attachment.description || attachment.mimeType || attachment.kind}</span>
                                    </>
                                )}
                            </div>

                            <div className="task-detail-attachment-actions-inline">
                                {attachment.publicUrl && (
                                    <a className="btn-icon" href={attachment.publicUrl} download={attachment.fileName || 'anexo'} title="Baixar">
                                        <Download size={16} />
                                    </a>
                                )}
                                <button type="button" className="btn-icon" title="Editar nome e descrição" onClick={() => {
                                    setEditingAttachmentId(attachment.id);
                                    setAttachmentDrafts((prev) => ({
                                        ...prev,
                                        [attachment.id]: {
                                            fileName: attachment.fileName || '',
                                            description: attachment.description || '',
                                        },
                                    }));
                                }}>
                                    <Edit3 size={16} />
                                </button>
                                <button type="button" className="btn-icon danger" title="Remover" onClick={() => handleRemoveAttachment(attachment)}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    );
                })}

                {!attachments.length && !loadingDomains && (
                    <button type="button" className="task-detail-empty task-detail-empty-upload" onClick={() => fileInputRef.current?.click()}>
                        <Upload size={16} />
                        <span>{uploading ? 'Enviando...' : 'Clique aqui para adicionar arquivo ou imagem'}</span>
                    </button>
                )}
            </div>
            {attachmentError && <div className="task-detail-error">{attachmentError}</div>}
        </div>
    );
}
