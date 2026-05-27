import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchChatMessages,
  sendChatMessage,
  markConversationDelivered,
  markMessagesRead,
  subscribeToChatMessages,
} from '../services/chatService';

const CHAT_PAGE_SIZE = 40;

function parseReactions(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  if (raw && typeof raw === 'object') return [...raw];
  return [];
}

function normalizeRow(row) {
  if (!row) return null;
  return {
    ...row,
    _localStatus: row._localStatus || 'sent',
    reactions: parseReactions(row.reactions),
  };
}

function sortMessages(list) {
  return [...list].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

function toMs(value) {
  const parsed = Date.parse(value || '');
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isLikelyOptimisticMatch(optimistic, incoming, myId) {
  if (!optimistic?._tempId || !incoming?.id) return false;
  if (incoming.sender_id !== myId || optimistic.sender_id !== myId) return false;
  if ((optimistic.message_type || 'text') !== (incoming.message_type || 'text')) return false;
  if ((optimistic.body || '').trim() !== (incoming.body || '').trim()) return false;
  if ((optimistic.attachment_url || '') !== (incoming.attachment_url || '')) return false;

  const optimisticMs = toMs(optimistic.created_at);
  const incomingMs = toMs(incoming.created_at);
  if (!optimisticMs || !incomingMs) return true;
  return Math.abs(optimisticMs - incomingMs) <= 30_000;
}

function mergeServerMessage(prev, tempId, row) {
  const normalized = normalizeRow({ ...row, _localStatus: 'sent' });
  if (!normalized?.id) {
    return prev.filter((m) => m._tempId !== tempId);
  }

  const withoutTemp = prev.filter((m) => m._tempId !== tempId);
  const existingIndex = withoutTemp.findIndex((m) => m.id === normalized.id);
  if (existingIndex >= 0) {
    const next = [...withoutTemp];
    next[existingIndex] = { ...next[existingIndex], ...normalized, _localStatus: 'sent' };
    return sortMessages(next);
  }
  return sortMessages([...withoutTemp, normalized]);
}

export function useChatMessages(conversationId, { enabled = true, myId, onNewMessage } = {}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const atBottomRef = useRef(true);
  const messagesRef = useRef([]);
  const cursorSupportedRef = useRef(true);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const loadInitial = useCallback(async () => {
    if (!conversationId || !enabled) return;
    setLoading(true);
    setError('');
    setHasMore(true);
    const { data, error: e, cursorSupported } = await fetchChatMessages(conversationId, { limit: CHAT_PAGE_SIZE });
    cursorSupportedRef.current = cursorSupported !== false;
    if (e) setError(e);
    const normalized = sortMessages((data || []).map(normalizeRow));
    setMessages(normalized);
    setHasMore((data || []).length === CHAT_PAGE_SIZE && cursorSupportedRef.current);
    setLoading(false);
    await markConversationDelivered(conversationId);
    const last = data?.[data.length - 1];
    if (last?.id) await markMessagesRead(conversationId, last.id);
  }, [conversationId, enabled]);
  const loadOlder = useCallback(async () => {
    if (!conversationId || !enabled || loading || loadingOlder || !hasMore) return;
    if (!cursorSupportedRef.current) return;
    const oldest = messagesRef.current[0];
    if (!oldest?.created_at) {
      setHasMore(false);
      return;
    }

    setLoadingOlder(true);
    const { data, error: e, cursorSupported } = await fetchChatMessages(conversationId, {
      limit: CHAT_PAGE_SIZE,
      beforeCreatedAt: oldest.created_at,
    });
    if (cursorSupported === false) {
      cursorSupportedRef.current = false;
      setHasMore(false);
      setLoadingOlder(false);
      return;
    }
    if (e) {
      setError(e);
      setLoadingOlder(false);
      return;
    }

    const older = sortMessages((data || []).map(normalizeRow));
    setMessages((prev) => {
      if (!older.length) return prev;
      const existing = new Set(prev.map((m) => m.id));
      const prepend = older.filter((m) => !existing.has(m.id));
      if (!prepend.length) return prev;
      return sortMessages([...prepend, ...prev]);
    });
    setHasMore((data || []).length === CHAT_PAGE_SIZE);
    setLoadingOlder(false);
  }, [conversationId, enabled, hasMore, loading, loadingOlder]);


  useEffect(() => {
    setMessages([]);
    if (conversationId && enabled) loadInitial();
  }, [conversationId, enabled, loadInitial]);

  const appendOrUpdate = useCallback((row) => {
    const n = normalizeRow(row);
    if (!n?.id) return;
    setMessages((prev) => {
      const idx = prev.findIndex((m) => {
        if (m.id === n.id) return true;
        if (!n._tempId) return false;
        return m._tempId === n._tempId;
      });
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...n, _localStatus: 'sent' };
        return sortMessages(next);
      }

      const optimisticIdx = prev.findIndex((m) => isLikelyOptimisticMatch(m, n, myId));
      if (optimisticIdx >= 0) {
        const next = [...prev];
        next[optimisticIdx] = { ...next[optimisticIdx], ...n, _localStatus: 'sent' };
        return sortMessages(next);
      }

      return sortMessages([...prev, n]);
    });
    if (atBottomRef.current) onNewMessage?.();
  }, [myId, onNewMessage]);

  const refreshReceipts = useCallback(async () => {
    if (!conversationId) return;
    const { data } = await fetchChatMessages(conversationId);
    if (!data) return;
    const map = new Map(data.map((m) => [m.id, m]));
    setMessages((prev) => prev.map((m) => {
      const r = map.get(m.id);
      if (!r) return m;
      return {
        ...m,
        peer_delivered_at: r.peer_delivered_at,
        peer_read_at: r.peer_read_at,
        reactions: Array.isArray(r.reactions) ? r.reactions : m.reactions,
      };
    }));
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId || !enabled) return undefined;
    return subscribeToChatMessages(conversationId, {
      onInsert: (row) => {
        appendOrUpdate(row);
        markConversationDelivered(conversationId);
        const last = messagesRef.current[messagesRef.current.length - 1];
        if (row?.id && row.sender_id !== myId) {
          markMessagesRead(conversationId, row.id);
        }
      },
      onUpdate: (row) => appendOrUpdate(row),
      onReceipts: () => refreshReceipts(),
      onReactions: () => refreshReceipts(),
    });
  }, [appendOrUpdate, conversationId, enabled, myId, refreshReceipts]);

  const sendText = useCallback(async (body) => {
    const trimmed = (body ?? '').trim();
    if (!trimmed || !conversationId) return { success: false };

    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      _tempId: tempId,
      conversation_id: conversationId,
      sender_id: myId,
      body: trimmed,
      message_type: 'text',
      created_at: new Date().toISOString(),
      _localStatus: 'sending',
      reactions: [],
    };
    setMessages((prev) => sortMessages([...prev, optimistic]));
    atBottomRef.current = true;
    onNewMessage?.();

    const { success, data, error: e } = await sendChatMessage(conversationId, { body: trimmed });
    if (!success) {
      setMessages((prev) => prev.filter((m) => m._tempId !== tempId));
      setError(e || 'Erro ao enviar');
      return { success: false, error: e };
    }
    setMessages((prev) => mergeServerMessage(prev, tempId, data));
    return { success: true, data };
  }, [conversationId, myId, onNewMessage]);

  const sendImage = useCallback(async (attachmentUrl, attachmentMeta, caption = '') => {
    if (!conversationId || !attachmentUrl) return { success: false };
    const tempId = `temp-img-${Date.now()}`;
    const optimistic = {
      id: tempId,
      _tempId: tempId,
      conversation_id: conversationId,
      sender_id: myId,
      body: caption,
      message_type: 'image',
      attachment_url: attachmentUrl,
      attachment_meta: attachmentMeta,
      created_at: new Date().toISOString(),
      _localStatus: 'sending',
      reactions: [],
    };
    setMessages((prev) => sortMessages([...prev, optimistic]));
    onNewMessage?.();

    const { success, data, error: e } = await sendChatMessage(conversationId, {
      body: caption,
      messageType: 'image',
      attachmentUrl,
      attachmentMeta,
    });
    if (!success) {
      setMessages((prev) => prev.filter((m) => m._tempId !== tempId));
      setError(e || 'Erro ao enviar imagem');
      return { success: false };
    }
    setMessages((prev) => mergeServerMessage(prev, tempId, data));
    return { success: true };
  }, [conversationId, myId, onNewMessage]);

  const markReadUpTo = useCallback(async (messageId) => {
    if (!conversationId) return;
    await markMessagesRead(conversationId, messageId);
    await refreshReceipts();
  }, [conversationId, refreshReceipts]);

  return {
    messages,
    loading,
    loadingOlder,
    hasMore,
    error,
    setError,
    sendText,
    sendImage,
    reload: loadInitial,
    loadOlder,
    refreshReceipts,
    markReadUpTo,
    setAtBottom: (v) => { atBottomRef.current = v; },
  };
}
