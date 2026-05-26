import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchChatMessages,
  sendChatMessage,
  markConversationDelivered,
  markMessagesRead,
  subscribeToChatMessages,
} from '../services/chatService';

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

export function useChatMessages(conversationId, { enabled = true, myId, onNewMessage } = {}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const atBottomRef = useRef(true);
  const messagesRef = useRef([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const loadInitial = useCallback(async () => {
    if (!conversationId || !enabled) return;
    setLoading(true);
    setError('');
    const { data, error: e } = await fetchChatMessages(conversationId);
    if (e) setError(e);
    setMessages(sortMessages((data || []).map(normalizeRow)));
    setLoading(false);
    await markConversationDelivered(conversationId);
    const last = data?.[data.length - 1];
    if (last?.id) await markMessagesRead(conversationId, last.id);
  }, [conversationId, enabled]);

  useEffect(() => {
    setMessages([]);
    if (conversationId && enabled) loadInitial();
  }, [conversationId, enabled, loadInitial]);

  const appendOrUpdate = useCallback((row) => {
    const n = normalizeRow(row);
    if (!n?.id) return;
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === n.id || m._tempId === n._tempId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...n, _localStatus: 'sent' };
        return sortMessages(next);
      }
      return sortMessages([...prev, n]);
    });
    if (atBottomRef.current) onNewMessage?.();
  }, [onNewMessage]);

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
    setMessages((prev) => {
      const without = prev.filter((m) => m._tempId !== tempId);
      return sortMessages([...without, normalizeRow({ ...data, _localStatus: 'sent' })]);
    });
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
    setMessages((prev) => {
      const without = prev.filter((m) => m._tempId !== tempId);
      return sortMessages([...without, normalizeRow({ ...data, _localStatus: 'sent' })]);
    });
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
    error,
    setError,
    sendText,
    sendImage,
    reload: loadInitial,
    refreshReceipts,
    markReadUpTo,
    setAtBottom: (v) => { atBottomRef.current = v; },
  };
}
