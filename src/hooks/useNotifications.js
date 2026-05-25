import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import {
    fetchNotificationInvitations,
    loadReadIds,
    saveReadIds,
} from '../services/notificationService';

export function useNotifications() {
    const { user } = useAuth();
    const [invitations, setInvitations] = useState([]);
    const [readIds, setReadIds] = useState(() => loadReadIds(user?.id));
    const [loading, setLoading] = useState(true);
    const prevInviteIdsRef = useRef(new Set());

    const refresh = useCallback(async () => {
        if (!user?.id) {
            setInvitations([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        const { data, error } = await fetchNotificationInvitations();
        if (!error) {
            const next = data || [];
            const nextIds = new Set(next.map((i) => i.id));
            const newOnes = next.filter((i) => !prevInviteIdsRef.current.has(i.id));
            if (newOnes.length > 0 && prevInviteIdsRef.current.size > 0) {
                window.dispatchEvent(new CustomEvent('notifications-new', {
                    detail: { invitations: newOnes },
                }));
            }
            prevInviteIdsRef.current = nextIds;
            setInvitations(next);
        }
        setLoading(false);
        window.dispatchEvent(new CustomEvent('notifications-updated'));
    }, [user?.id]);

    useEffect(() => {
        setReadIds(loadReadIds(user?.id));
        prevInviteIdsRef.current = new Set();
        refresh();
    }, [user?.id, refresh]);

    useEffect(() => {
        if (!user?.id) return undefined;

        const channel = supabase
            .channel(`notifications-${user.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'board_invitations' },
                () => {
                    refresh();
                }
            )
            .subscribe();

        const onFocus = () => refresh();
        window.addEventListener('focus', onFocus);

        return () => {
            supabase.removeChannel(channel);
            window.removeEventListener('focus', onFocus);
        };
    }, [user?.id, refresh]);

    const unreadCount = invitations.filter((inv) => !readIds.has(inv.id)).length;

    const markRead = useCallback((id) => {
        if (!user?.id || !id) return;
        setReadIds((prev) => {
            const next = new Set(prev);
            next.add(id);
            saveReadIds(user.id, next);
            return next;
        });
    }, [user?.id]);

    const markAllRead = useCallback(() => {
        if (!user?.id) return;
        const next = new Set(invitations.map((i) => i.id));
        setReadIds(next);
        saveReadIds(user.id, next);
    }, [user?.id, invitations]);

    const notifications = invitations.map((inv) => ({
        id: inv.id,
        kind: inv.kind || 'board',
        type: 'invitation',
        boardId: inv.boardId,
        spaceId: inv.spaceId,
        boardTitle: inv.boardTitle,
        boardEmoji: inv.boardEmoji,
        spaceTitle: inv.spaceTitle,
        spaceEmoji: inv.spaceEmoji,
        role: inv.role,
        read: readIds.has(inv.id),
        time: inv.createdAt
            ? new Date(inv.createdAt).toLocaleString('pt-BR', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
            })
            : '',
    }));

    return {
        notifications,
        invitations,
        unreadCount,
        loading,
        refresh,
        markRead,
        markAllRead,
    };
}
