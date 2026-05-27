import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import {
    fetchNotificationInvitations,
    fetchIncomingContactRequests,
    fetchOutgoingContactOutcomes,
    fetchIncomingMessageNotifications,
    loadReadIds,
    saveReadIds,
    mergeNotificationItems,
    notificationReadKey,
    notificationEventKey,
    contactRequestRowToNotification,
} from '../services/notificationService';

function formatNotificationTime(createdAt) {
    if (!createdAt) return '';
    return new Date(createdAt).toLocaleString('pt-BR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function useNotifications() {
    const { user } = useAuth();
    const [items, setItems] = useState([]);
    const [readIds, setReadIds] = useState(() => loadReadIds(user?.id));
    const [loading, setLoading] = useState(true);
    const prevIdsRef = useRef(new Set());
    const notificationsReadyRef = useRef(false);
    const activeChatConvRef = useRef(null);

    const dispatchPopup = useCallback((list) => {
        const popupOnes = (list || []).filter((n) => {
            if (n.type === 'chat_message' && n.conversationId === activeChatConvRef.current) {
                return false;
            }
            return true;
        });
        if (!popupOnes.length) return;
        window.dispatchEvent(new CustomEvent('notifications-new', {
            detail: { notifications: popupOnes },
        }));
    }, []);

    const refresh = useCallback(async () => {
        if (!user?.id) {
            setItems([]);
            setLoading(false);
            return;
        }
        setLoading(true);

        const [
            { data: invitations, error: invErr },
            { data: contactReqs, error: crErr },
            { data: contactOutcomes, error: coErr },
            { data: chatMessages, error: msgErr },
        ] = await Promise.all([
            fetchNotificationInvitations(),
            fetchIncomingContactRequests(user.id),
            fetchOutgoingContactOutcomes(user.id),
            fetchIncomingMessageNotifications(user.id),
        ]);

        if (!invErr && !crErr && !coErr && !msgErr) {
            const merged = mergeNotificationItems(
                invitations || [],
                contactReqs || [],
                contactOutcomes || [],
                chatMessages || []
            );
            const nextKeys = new Set(merged.map((n) => notificationEventKey(n)));
            const newOnes = merged.filter((n) => !prevIdsRef.current.has(notificationEventKey(n)));

            if (newOnes.length > 0 && notificationsReadyRef.current) {
                dispatchPopup(newOnes);
            }

            prevIdsRef.current = nextKeys;
            notificationsReadyRef.current = true;
            setItems(merged);
        }

        setLoading(false);
        window.dispatchEvent(new CustomEvent('notifications-updated'));
        window.dispatchEvent(new CustomEvent('contacts-updated'));
    }, [dispatchPopup, user?.id]);

    const handleIncomingContactRequestRow = useCallback(async (row) => {
        if (!user?.id || !row) return;
        if (row.status !== 'pending' || row.to_user_id !== user.id) return;

        const { data: profile } = await supabase
            .from('profiles')
            .select('id, username, name, avatar, photo_url')
            .eq('id', row.from_user_id)
            .maybeSingle();

        const notification = contactRequestRowToNotification(row, profile);
        if (!notification) return;

        const key = notificationEventKey(notification);
        if (prevIdsRef.current.has(key)) return;

        prevIdsRef.current.add(key);
        if (notificationsReadyRef.current) {
            dispatchPopup([notification]);
        }
        refresh();
    }, [dispatchPopup, refresh, user?.id]);

    useEffect(() => {
        setReadIds(loadReadIds(user?.id));
        prevIdsRef.current = new Set();
        notificationsReadyRef.current = false;
        refresh();
    }, [user?.id, refresh]);

    useEffect(() => {
        if (!user?.id) return undefined;

        const channel = supabase
            .channel(`notifications-${user.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'board_invitations' },
                () => refresh()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'space_invitations' },
                () => refresh()
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'contact_requests',
                    filter: `to_user_id=eq.${user.id}`,
                },
                (payload) => {
                    void handleIncomingContactRequestRow(payload.new);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'contact_requests',
                    filter: `to_user_id=eq.${user.id}`,
                },
                (payload) => {
                    void handleIncomingContactRequestRow(payload.new);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'contact_requests',
                    filter: `from_user_id=eq.${user.id}`,
                },
                () => refresh()
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                },
                () => refresh()
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'dm_message_requests',
                    filter: `recipient_id=eq.${user.id}`,
                },
                () => refresh()
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'dm_request_messages',
                },
                () => refresh()
            )
            .subscribe();

        const onFocus = () => refresh();
        const onChatActive = (e) => {
            activeChatConvRef.current = e.detail?.conversationId || null;
        };
        const onMarkRead = (e) => {
            const n = e.detail?.notification;
            if (!n || !user?.id) return;
            const key = notificationReadKey(n);
            if (!key) return;
            setReadIds((prev) => {
                const next = new Set(prev);
                next.add(key);
                saveReadIds(user.id, next);
                return next;
            });
        };

        window.addEventListener('focus', onFocus);
        window.addEventListener('app-chat-active', onChatActive);
        window.addEventListener('app-notification-mark-read', onMarkRead);

        return () => {
            supabase.removeChannel(channel);
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('app-chat-active', onChatActive);
            window.removeEventListener('app-notification-mark-read', onMarkRead);
        };
    }, [handleIncomingContactRequestRow, refresh, user?.id]);

    const unreadCount = items.filter((n) => !readIds.has(notificationReadKey(n))).length;

    const markRead = useCallback((idOrNotification) => {
        if (!user?.id) return;
        const key = typeof idOrNotification === 'object'
            ? notificationReadKey(idOrNotification)
            : idOrNotification;
        if (!key) return;
        setReadIds((prev) => {
            const next = new Set(prev);
            next.add(key);
            saveReadIds(user.id, next);
            return next;
        });
    }, [user?.id]);

    const markAllRead = useCallback(() => {
        if (!user?.id) return;
        const next = new Set(items.map((n) => notificationReadKey(n)));
        setReadIds(next);
        saveReadIds(user.id, next);
    }, [user?.id, items]);

    const notifications = items.map((n) => {
        const read = readIds.has(notificationReadKey(n));
        const base = {
            id: n.id,
            type: n.type,
            read,
            time: formatNotificationTime(n.createdAt),
            createdAt: n.createdAt,
            updatedAt: n.updatedAt,
        };

        if (n.type === 'contact_request' || n.type === 'contact_accepted' || n.type === 'contact_declined') {
            return {
                ...base,
                fromUserId: n.fromUserId,
                senderName: n.senderName,
                senderUsername: n.senderUsername,
                senderAvatar: n.senderAvatar,
                senderPhotoUrl: n.senderPhotoUrl,
            };
        }

        if (n.type === 'chat_message') {
            return {
                ...base,
                conversationId: n.conversationId,
                fromUserId: n.fromUserId,
                messagePreview: n.messagePreview,
                senderName: n.senderName,
                senderUsername: n.senderUsername,
                senderAvatar: n.senderAvatar,
                senderPhotoUrl: n.senderPhotoUrl,
            };
        }

        return {
            ...base,
            kind: n.kind || 'board',
            boardId: n.boardId,
            spaceId: n.spaceId,
            boardTitle: n.boardTitle,
            boardEmoji: n.boardEmoji,
            spaceTitle: n.spaceTitle,
            spaceEmoji: n.spaceEmoji,
            role: n.role,
        };
    });

    return {
        notifications,
        items,
        unreadCount,
        loading,
        refresh,
        markRead,
        markAllRead,
    };
}
