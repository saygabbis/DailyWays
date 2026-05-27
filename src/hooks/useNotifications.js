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
import { getNotificationPrefs } from '../services/notificationPrefs';

function formatNotificationTime(createdAt) {
    if (!createdAt) return '';
    return new Date(createdAt).toLocaleString('pt-BR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getPrimaryFaviconLink() {
    if (typeof document === 'undefined') return null;
    return document.querySelector('link[rel="icon"]')
        || document.querySelector('link[rel="shortcut icon"]')
        || document.querySelector('link[rel*="icon"]');
}

export function useNotifications() {
    const { user } = useAuth();
    const [items, setItems] = useState([]);
    const [readIds, setReadIds] = useState(() => loadReadIds(user?.id));
    const [loading, setLoading] = useState(true);
    const prevIdsRef = useRef(new Set());
    const notificationsReadyRef = useRef(false);
    const activeChatConvRef = useRef(null);
    const baseTitleRef = useRef(typeof document !== 'undefined' ? document.title : 'DailyWays');
    const faviconLinkRef = useRef(null);
    const baseFaviconHrefRef = useRef('');
    const badgedFaviconCacheRef = useRef(new Map());
    const audioCtxRef = useRef(null);

    const playNotificationSound = useCallback(() => {
        const prefs = getNotificationPrefs();
        if (!prefs.soundEnabled) return;
        if (typeof window === 'undefined') return;
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;

        try {
            if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
            const ctx = audioCtxRef.current;
            const startAt = ctx.currentTime + 0.01;

            const makeBeep = (offset, frequency, gainValue, duration) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = frequency;
                gain.gain.setValueAtTime(0.0001, startAt + offset);
                gain.gain.exponentialRampToValueAtTime(gainValue, startAt + offset + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + duration);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(startAt + offset);
                osc.stop(startAt + offset + duration + 0.02);
            };

            makeBeep(0, 880, 0.04, 0.09);
            makeBeep(0.11, 660, 0.03, 0.1);
        } catch {
            // browser may block audio without prior user interaction
        }
    }, []);

    const ensureBadgedFavicon = useCallback(async (count) => {
        const link = faviconLinkRef.current || getPrimaryFaviconLink();
        if (!link) return;
        faviconLinkRef.current = link;
        if (!baseFaviconHrefRef.current) {
            baseFaviconHrefRef.current = link.href || link.getAttribute('href') || '';
        }
        if (!baseFaviconHrefRef.current || count <= 0) return;

        const cacheKey = count > 99 ? '99+' : String(count);
        const cached = badgedFaviconCacheRef.current.get(cacheKey);
        if (cached) {
            link.href = cached;
            return;
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';
        const loaded = await new Promise((resolve) => {
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = baseFaviconHrefRef.current;
        });
        if (!loaded) return;

        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);

        const radius = 20;
        const cx = size - 18;
        const cy = 18;
        ctx.fillStyle = '#ff3b30';
        ctx.beginPath();
        ctx.arc(cx, cy, radius - 1, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 23px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cacheKey, cx, cy + 1);

        const dataUrl = canvas.toDataURL('image/png');
        badgedFaviconCacheRef.current.set(cacheKey, dataUrl);
        link.href = dataUrl;
    }, []);

    const dispatchPopup = useCallback((list) => {
        const prefs = getNotificationPrefs();
        if (!prefs.pushEnabled) return [];
        const popupOnes = (list || []).filter((n) => {
            if (n.type === 'chat_message' && n.conversationId === activeChatConvRef.current) {
                return false;
            }
            return true;
        });
        if (!popupOnes.length) return [];
        window.dispatchEvent(new CustomEvent('notifications-new', {
            detail: { notifications: popupOnes },
        }));
        return popupOnes;
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
                const popupOnes = dispatchPopup(newOnes);
                if (popupOnes.length > 0) playNotificationSound();
            }

            prevIdsRef.current = nextKeys;
            notificationsReadyRef.current = true;
            setItems(merged);
        }

        setLoading(false);
        window.dispatchEvent(new CustomEvent('notifications-updated'));
        window.dispatchEvent(new CustomEvent('contacts-updated'));
    }, [dispatchPopup, user?.id, playNotificationSound]);

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
            const popupOnes = dispatchPopup([notification]);
            if (popupOnes.length > 0) playNotificationSound();
        }
        refresh();
    }, [dispatchPopup, refresh, user?.id, playNotificationSound]);

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

    useEffect(() => {
        if (typeof document === 'undefined') return;
        const baseTitle = baseTitleRef.current || document.title || 'DailyWays';
        document.title = unreadCount > 0
            ? `(${unreadCount > 99 ? '99+' : unreadCount}) ${baseTitle}`
            : baseTitle;

        const link = getPrimaryFaviconLink();
        if (link) {
            faviconLinkRef.current = link;
            if (!baseFaviconHrefRef.current) {
                baseFaviconHrefRef.current = link.href || link.getAttribute('href') || '';
            }
            if (unreadCount > 0) {
                void ensureBadgedFavicon(unreadCount);
            } else if (baseFaviconHrefRef.current) {
                link.href = baseFaviconHrefRef.current;
            }
        }
    }, [unreadCount, ensureBadgedFavicon]);

    useEffect(() => () => {
        if (typeof document !== 'undefined') {
            document.title = baseTitleRef.current || document.title;
        }
        const link = faviconLinkRef.current || getPrimaryFaviconLink();
        if (link && baseFaviconHrefRef.current) {
            link.href = baseFaviconHrefRef.current;
        }
        if (audioCtxRef.current) {
            try {
                audioCtxRef.current.close();
            } catch {
                // noop
            }
        }
    }, []);

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
