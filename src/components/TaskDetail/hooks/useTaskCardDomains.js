/**
 * Domínios "satélite" do card no modal: anexos, capa, comentários, atividade e responsáveis.
 * Carrega tudo junto, assina realtime de cada um e expõe os handlers (cada ação gera log de atividade).
 */
import { useEffect, useState } from 'react';
import { initialFromName } from '../../../utils/userColor';
import {
    fetchAttachments,
    uploadAttachment,
    createLinkAttachment,
    removeAttachment,
    subscribeToAttachments,
    renameAttachment,
} from '../../../services/attachmentService';
import { fetchComments, createComment, softDeleteComment, subscribeToComments } from '../../../services/commentService';
import { fetchActivity, createActivity, subscribeToActivity } from '../../../services/activityService';
import { fetchAssignees, fetchBoardCandidates, assignUser, removeUser, subscribeToAssignees } from '../../../services/assigneeService';
import { primeCardCover } from '../../../hooks/useCardCoverImage';

export function useTaskCardDomains({ card, liveCard, boardId, listId, user, collabDispatch, showConfirm, commentBody, setCommentBody }) {
    const [attachments, setAttachments] = useState([]);
    const [comments, setComments] = useState([]);
    const [activity, setActivity] = useState([]);
    const [assignees, setAssignees] = useState([]);
    const [boardCandidates, setBoardCandidates] = useState([]);
    const [linkUrl, setLinkUrl] = useState('');
    const [linkLabel, setLinkLabel] = useState('');
    const [showLinkForm, setShowLinkForm] = useState(false);
    const [loadingDomains, setLoadingDomains] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [savingComment, setSavingComment] = useState(false);
    const [savingAssignee, setSavingAssignee] = useState(false);
    const [attachmentError, setAttachmentError] = useState('');
    const [editingAttachmentId, setEditingAttachmentId] = useState(null);
    const [attachmentDrafts, setAttachmentDrafts] = useState({});
    const [showCoverPanel, setShowCoverPanel] = useState(false);

    const coverAttachment = attachments.find((item) => item.id === liveCard.coverAttachmentId) || null;
    const imageAttachments = attachments.filter((item) => item.kind === 'image' && item.publicUrl);
    const visibleComments = comments.filter((item) => !item.deletedAt);

    const assigneeProfiles = assignees.map((item) => {
        const candidate = boardCandidates.find((candidateItem) => candidateItem.userId === item.userId);
        return {
            ...item,
            name: candidate?.name || candidate?.username || 'Usuário',
            photoUrl: candidate?.photo_url || '',
            avatar: candidate?.avatar || initialFromName(candidate?.name || candidate?.username || 'U'),
        };
    });

    useEffect(() => {
        let active = true;

        async function loadDomains() {
            setLoadingDomains(true);
            const [attachmentsResult, commentsResult, activityResult, assigneesResult, candidatesResult] = await Promise.all([
                fetchAttachments(card.id),
                fetchComments(card.id),
                fetchActivity(card.id),
                fetchAssignees(card.id),
                fetchBoardCandidates(boardId),
            ]);

            if (!active) return;
            setAttachments(attachmentsResult.data || []);
            setComments(commentsResult.data || []);
            setActivity(activityResult.data || []);
            setAssignees(assigneesResult.data || []);
            setBoardCandidates(candidatesResult.data || []);
            setLoadingDomains(false);
        }

        loadDomains();

        const unsubAttachments = subscribeToAttachments(card.id, () => fetchAttachments(card.id).then((result) => active && setAttachments(result.data || [])));
        const unsubComments = subscribeToComments(card.id, () => fetchComments(card.id).then((result) => active && setComments(result.data || [])));
        const unsubActivity = subscribeToActivity(card.id, () => fetchActivity(card.id).then((result) => active && setActivity(result.data || [])));
        const unsubAssignees = subscribeToAssignees(card.id, () => fetchAssignees(card.id).then((result) => active && setAssignees(result.data || [])));

        return () => {
            active = false;
            unsubAttachments();
            unsubComments();
            unsubActivity();
            unsubAssignees();
        };
    }, [card.id, boardId]);

    const handleUploadFiles = async (event) => {
        const files = Array.from(event.target.files || []);
        if (!files.length || !user?.id) return;

        setAttachmentError('');
        setUploading(true);
        // Capa automática: a primeira imagem vira capa se o card não tem uma capa VÁLIDA (sem capa
        // ou apontando para um anexo que já foi apagado — antes isso travava a capa para sempre).
        let hasCover = Boolean(liveCard.coverAttachmentId)
            && attachments.some((a) => a.id === liveCard.coverAttachmentId && a.kind === 'image');
        for (const file of files) {
            const result = await uploadAttachment(card.id, file, user.id);
            if (result.success) {
                await createActivity(card.id, user.id, 'attachment_added', { fileName: file.name });
                if (!hasCover && result.data?.kind === 'image') {
                    hasCover = true;
                    await handleSetCover(result.data);
                }
            } else {
                setAttachmentError(result.error || 'Não foi possível adicionar o anexo.');
            }
        }
        setUploading(false);
        event.target.value = '';
    };

    const handleAddLink = async (event) => {
        event.preventDefault();
        if (!linkUrl.trim() || !user?.id) return;

        const result = await createLinkAttachment(card.id, linkUrl.trim(), linkLabel.trim(), user.id);
        if (result.success) {
            await createActivity(card.id, user.id, 'attachment_added', { linkUrl: linkUrl.trim() });
            setLinkUrl('');
            setLinkLabel('');
            setShowLinkForm(false);
        } else {
            setAttachmentError(result.error || 'Não foi possível salvar o link.');
        }
    };

    const handleRemoveAttachment = async (attachment) => {
        const confirmed = await showConfirm({
            title: 'Remover anexo',
            message: `Tem certeza que deseja remover "${attachment.fileName || attachment.linkLabel || 'este anexo'}"?`,
            confirmLabel: 'Remover',
            type: 'danger',
        });

        if (!confirmed) return;

        const result = await removeAttachment(attachment);
        if (result.success && user?.id) {
            setAttachments((prev) => prev.filter((item) => item.id !== attachment.id));
            if (liveCard.coverAttachmentId === attachment.id) {
                collabDispatch({
                    type: 'UPDATE_CARD',
                    payload: {
                        boardId,
                        listId,
                        cardId: card.id,
                        updates: { coverAttachmentId: null, coverPreviewUrl: null },
                    },
                });
            }
            await createActivity(card.id, user.id, 'attachment_removed', { attachmentId: attachment.id });
        } else if (!result.success) {
            setAttachmentError(result.error || 'Não foi possível remover o anexo.');
        }
    };

    // A capa é um campo do card: vai pelo mesmo caminho das outras edições (collab ou fallback).
    // Antes também havia um UPDATE direto na tabela, e o flush do servidor podia sobrescrevê-lo.
    const handleSetCover = async (attachment) => {
        if (!attachment?.id) return;
        if (attachment.publicUrl) primeCardCover(attachment.id, attachment.publicUrl);
        collabDispatch({
            type: 'UPDATE_CARD',
            payload: {
                boardId,
                listId,
                cardId: card.id,
                updates: { coverAttachmentId: attachment.id, coverPreviewUrl: attachment.publicUrl || null },
            },
        });
        setShowCoverPanel(false);
        if (user?.id) await createActivity(card.id, user.id, 'cover_set', { attachmentId: attachment.id });
    };

    const handleClearCover = async () => {
        collabDispatch({
            type: 'UPDATE_CARD',
            payload: {
                boardId,
                listId,
                cardId: card.id,
                updates: { coverAttachmentId: null, coverPreviewUrl: null },
            },
        });
        setShowCoverPanel(false);
        if (user?.id) await createActivity(card.id, user.id, 'cover_cleared', {});
    };

    const handleAttachmentDraftChange = (attachmentId, field, value) => {
        setAttachmentDrafts((prev) => ({
            ...prev,
            [attachmentId]: {
                ...(prev[attachmentId] || {}),
                [field]: value,
            },
        }));
    };

    const handleSaveAttachmentMeta = async (attachment) => {
        const draft = attachmentDrafts[attachment.id] || {};
        const result = await renameAttachment(attachment.id, {
            fileName: draft.fileName ?? attachment.fileName,
            description: draft.description ?? attachment.description,
        });

        if (result.success) {
            setAttachments((prev) => prev.map((item) => item.id === attachment.id ? {
                ...item,
                fileName: draft.fileName ?? item.fileName,
                description: draft.description ?? item.description,
                linkLabel: draft.description ?? item.linkLabel,
            } : item));
            setEditingAttachmentId(null);
        } else {
            setAttachmentError(result.error || 'Não foi possível atualizar o anexo.');
        }
    };

    const handleCreateComment = async (event) => {
        event.preventDefault();
        if (!commentBody.trim() || !user?.id) return;

        setSavingComment(true);
        const result = await createComment(card.id, commentBody.trim(), user.id);
        if (result.success) {
            await createActivity(card.id, user.id, 'comment_added', {});
            setCommentBody('');
        }
        setSavingComment(false);
    };

    const handleDeleteComment = async (commentId) => {
        const confirmed = await showConfirm({
            title: 'Remover comentário',
            message: 'Tem certeza que deseja remover este comentário?',
            confirmLabel: 'Remover',
            type: 'danger',
        });
        if (!confirmed) return;

        const result = await softDeleteComment(commentId);
        if (result.success && user?.id) {
            setComments((prev) => prev.map((item) => item.id === commentId ? { ...item, deletedAt: new Date().toISOString() } : item));
            await createActivity(card.id, user.id, 'comment_deleted', { commentId });
        }
    };

    const handleAssignUser = async (event) => {
        const nextUserId = event.target.value;
        if (!nextUserId || !user?.id) return;

        setSavingAssignee(true);
        const result = await assignUser(card.id, nextUserId, user.id);
        if (result.success) {
            await createActivity(card.id, user.id, 'assignee_added', { userId: nextUserId });
        }
        setSavingAssignee(false);
        event.target.value = '';
    };

    const handleRemoveAssignee = async (userIdToRemove) => {
        const result = await removeUser(card.id, userIdToRemove);
        if (result.success && user?.id) {
            setAssignees((prev) => prev.filter((item) => item.userId !== userIdToRemove));
            await createActivity(card.id, user.id, 'assignee_removed', { userId: userIdToRemove });
        }
    };

    return {
        attachments,
        comments,
        activity,
        assigneeProfiles,
        boardCandidates,
        coverAttachment,
        imageAttachments,
        visibleComments,
        linkUrl,
        setLinkUrl,
        linkLabel,
        setLinkLabel,
        showLinkForm,
        setShowLinkForm,
        loadingDomains,
        uploading,
        savingComment,
        savingAssignee,
        attachmentError,
        setAttachmentError,
        editingAttachmentId,
        setEditingAttachmentId,
        attachmentDrafts,
        setAttachmentDrafts,
        assignees,
        showCoverPanel,
        setShowCoverPanel,
        handleUploadFiles,
        handleAddLink,
        handleRemoveAttachment,
        handleSetCover,
        handleClearCover,
        handleAttachmentDraftChange,
        handleSaveAttachmentMeta,
        handleCreateComment,
        handleDeleteComment,
        handleAssignUser,
        handleRemoveAssignee,
    };
}
