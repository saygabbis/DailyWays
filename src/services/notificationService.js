import { supabase } from './supabaseClient';
import { fetchMyInvitations } from './boardService';

export function getReadIdsKey(userId) {
    return userId ? `dailyways_notifications_read_${userId}` : null;
}

/** @deprecated use getReadIdsKey */
export function getReadIdsKeyLegacy(userId) {
    return userId ? `dailyways_invite_read_${userId}` : null;
}

export function loadReadIds(userId) {
    const key = getReadIdsKey(userId);
    if (!key) return new Set();
    try {
        const raw = window.localStorage.getItem(key);
        if (raw) {
            const arr = JSON.parse(raw);
            return new Set(Array.isArray(arr) ? arr : []);
        }
        // Migra chave antiga só de convites
        const legacyKey = getReadIdsKeyLegacy(userId);
        const legacyRaw = legacyKey ? window.localStorage.getItem(legacyKey) : null;
        const legacyArr = legacyRaw ? JSON.parse(legacyRaw) : [];
        return new Set(Array.isArray(legacyArr) ? legacyArr : []);
    } catch {
        return new Set();
    }
}

export function saveReadIds(userId, readSet) {
    const key = getReadIdsKey(userId);
    if (!key) return;
    try {
        window.localStorage.setItem(key, JSON.stringify(Array.from(readSet)));
    } catch {
        /* ignore */
    }
}

/** Chave estável para marcar como lida no localStorage. */
export function notificationReadKey(notification) {
    if (!notification?.id && !notification?.conversationId) return '';
    if (notification.type === 'contact_request') {
        const ts = notification.updatedAt || notification.createdAt || '';
        return `cr:${notification.id}:${ts}`;
    }
    if (notification.type === 'contact_accepted') {
        const ts = notification.updatedAt || notification.createdAt || '';
        return `cra:${notification.id}:${ts}`;
    }
    if (notification.type === 'contact_declined') {
        const ts = notification.updatedAt || notification.createdAt || '';
        return `crd:${notification.id}:${ts}`;
    }
    if (notification.type === 'chat_message') return `msg:${notification.id}`;
    return String(notification.id);
}

/** Chave para detectar evento novo (popup / sino) — igual à de leitura. */
export function notificationEventKey(notification) {
    return notificationReadKey(notification);
}

export function contactRequestRowToNotification(row, profile) {
    if (!row?.id) return null;
    return {
        type: 'contact_request',
        id: row.id,
        fromUserId: row.from_user_id,
        senderName: profile?.name || null,
        senderUsername: profile?.username || null,
        senderAvatar: profile?.avatar || null,
        senderPhotoUrl: profile?.photo_url || null,
        createdAt: row.updated_at || row.created_at,
        updatedAt: row.updated_at || row.created_at,
    };
}

const OUTCOME_WINDOW_DAYS = 7;
const MESSAGE_WINDOW_DAYS = 7;

async function attachProfiles(userIds) {
    const ids = [...new Set((userIds || []).filter(Boolean))];
    if (!ids.length) return new Map();
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, name, avatar, photo_url')
        .in('id', ids);
    return new Map((profiles || []).map((p) => [p.id, p]));
}

function profileFields(p) {
    return {
        senderName: p?.name || null,
        senderUsername: p?.username || null,
        senderAvatar: p?.avatar || null,
        senderPhotoUrl: p?.photo_url || null,
    };
}

export async function fetchNotificationInvitations() {
    const { data, error } = await fetchMyInvitations();
    if (error || !data?.length) {
        return { data: data || [], error };
    }

    const boardIds = [...new Set(data.filter((inv) => inv.kind !== 'space').map((inv) => inv.boardId).filter(Boolean))];
    const spaceIds = [...new Set(data.filter((inv) => inv.kind === 'space').map((inv) => inv.spaceId).filter(Boolean))];

    const boardMap = new Map();
    if (boardIds.length > 0) {
        const { data: boards } = await supabase
            .from('boards')
            .select('id, title, emoji')
            .in('id', boardIds);
        for (const b of boards || []) boardMap.set(b.id, b);
    }

    const spaceMap = new Map();
    if (spaceIds.length > 0) {
        const { data: spaces } = await supabase
            .from('spaces')
            .select('id, title, emoji')
            .in('id', spaceIds);
        for (const s of spaces || []) spaceMap.set(s.id, s);
    }

    return {
        data: data.map((inv) => {
            if (inv.kind === 'space') {
                const s = spaceMap.get(inv.spaceId);
                return {
                    ...inv,
                    spaceTitle: s?.title || inv.spaceTitle || 'Space compartilhado',
                    spaceEmoji: s?.emoji || inv.spaceEmoji || '🌌',
                };
            }
            const b = boardMap.get(inv.boardId);
            return {
                ...inv,
                boardTitle: b?.title || inv.boardTitle || 'Board compartilhado',
                boardEmoji: b?.emoji || inv.boardEmoji || '📋',
            };
        }),
        error: null,
    };
}

export async function fetchIncomingContactRequests(userId) {
    if (!userId) return { data: [], error: null };

    const { data, error } = await supabase
        .from('contact_requests')
        .select('id, from_user_id, to_user_id, status, created_at, updated_at')
        .eq('to_user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (error) return { data: [], error: error.message || 'Erro ao carregar pedidos de contato.' };

    const requests = data || [];
    const profileMap = await attachProfiles(requests.map((r) => r.from_user_id));

    return {
        data: requests.map((r) => {
            const p = profileMap.get(r.from_user_id);
            return { ...r, ...profileFields(p) };
        }),
        error: null,
    };
}

/** Pedidos que você enviou e foram aceitos ou recusados (para notificar o remetente). */
export async function fetchOutgoingContactOutcomes(userId) {
    if (!userId) return { data: [], error: null };

    const since = new Date();
    since.setDate(since.getDate() - OUTCOME_WINDOW_DAYS);

    const { data, error } = await supabase
        .from('contact_requests')
        .select('id, from_user_id, to_user_id, status, created_at, updated_at')
        .eq('from_user_id', userId)
        .in('status', ['accepted', 'declined'])
        .gte('updated_at', since.toISOString())
        .order('updated_at', { ascending: false });

    if (error) return { data: [], error: error.message || 'Erro ao carregar respostas de contato.' };

    const requests = data || [];
    const profileMap = await attachProfiles(requests.map((r) => r.to_user_id));

    return {
        data: requests.map((r) => {
            const p = profileMap.get(r.to_user_id);
            return { ...r, ...profileFields(p) };
        }),
        error: null,
    };
}

/** Última mensagem recebida por conversa (DM), para o sino de notificações. */
export async function fetchIncomingMessageNotifications(userId) {
    if (!userId) return { data: [], error: null };

    const since = new Date();
    since.setDate(since.getDate() - MESSAGE_WINDOW_DAYS);

    const { data: parts, error: partErr } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', userId);

    if (partErr) return { data: [], error: partErr.message };
    const convIds = [...new Set((parts || []).map((p) => p.conversation_id).filter(Boolean))];
    if (!convIds.length) return { data: [], error: null };

    const { data: messages, error: msgErr } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, body, created_at')
        .in('conversation_id', convIds)
        .neq('sender_id', userId)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(80);

    if (msgErr) return { data: [], error: msgErr.message };

    const latestByConv = new Map();
    for (const m of messages || []) {
        if (!latestByConv.has(m.conversation_id)) latestByConv.set(m.conversation_id, m);
    }

    const rows = [...latestByConv.values()];

    const { data: myContacts } = await supabase
        .from('contacts')
        .select('contact_user_id, notify_messages');
    const mutedSenderIds = new Set(
        (myContacts || [])
            .filter((c) => c.notify_messages === false)
            .map((c) => c.contact_user_id)
    );
    const visibleRows = rows.filter((m) => !mutedSenderIds.has(m.sender_id));

    const profileMap = await attachProfiles(visibleRows.map((m) => m.sender_id));

    return {
        data: visibleRows.map((m) => {
            const p = profileMap.get(m.sender_id);
            return {
                ...m,
                ...profileFields(p),
            };
        }),
        error: null,
    };
}

function dedupeChatMessages(items) {
    const chatByConv = new Map();
    const rest = [];
    for (const n of items) {
        if (n.type !== 'chat_message') {
            rest.push(n);
            continue;
        }
        const existing = chatByConv.get(n.conversationId);
        if (!existing || new Date(n.createdAt) > new Date(existing.createdAt)) {
            chatByConv.set(n.conversationId, n);
        }
    }
    return [...rest, ...chatByConv.values()];
}

export function mergeNotificationItems(
    invitations = [],
    contactRequests = [],
    contactOutcomes = [],
    chatMessages = []
) {
    const invItems = invitations.map((inv) => ({
        type: 'invitation',
        id: inv.id,
        kind: inv.kind || 'board',
        boardId: inv.boardId,
        spaceId: inv.spaceId,
        boardTitle: inv.boardTitle,
        boardEmoji: inv.boardEmoji,
        spaceTitle: inv.spaceTitle,
        spaceEmoji: inv.spaceEmoji,
        role: inv.role,
        createdAt: inv.createdAt,
    }));

    const crItems = contactRequests.map((r) => ({
        type: 'contact_request',
        id: r.id,
        fromUserId: r.from_user_id,
        senderName: r.senderName,
        senderUsername: r.senderUsername,
        senderAvatar: r.senderAvatar,
        senderPhotoUrl: r.senderPhotoUrl,
        createdAt: r.updated_at || r.created_at,
        updatedAt: r.updated_at || r.created_at,
    }));

    const outcomeItems = contactOutcomes.map((r) => ({
        type: r.status === 'accepted' ? 'contact_accepted' : 'contact_declined',
        id: r.id,
        fromUserId: r.to_user_id,
        senderName: r.senderName,
        senderUsername: r.senderUsername,
        senderAvatar: r.senderAvatar,
        senderPhotoUrl: r.senderPhotoUrl,
        createdAt: r.updated_at || r.created_at,
        updatedAt: r.updated_at || r.created_at,
    }));

    const msgItems = chatMessages.map((m) => ({
        type: 'chat_message',
        id: m.id,
        conversationId: m.conversation_id,
        fromUserId: m.sender_id,
        messagePreview: (m.body || '').slice(0, 120),
        senderName: m.senderName,
        senderUsername: m.senderUsername,
        senderAvatar: m.senderAvatar,
        senderPhotoUrl: m.senderPhotoUrl,
        createdAt: m.created_at,
    }));

    return dedupeChatMessages([...invItems, ...crItems, ...outcomeItems, ...msgItems]).sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );
}
