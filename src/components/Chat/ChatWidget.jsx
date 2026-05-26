import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MessageCircle,
  X,
  Pin,
  PinOff,
  Search,
  Users,
  Inbox,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { fetchContacts, searchContactTargets, sendContactRequest } from '../../services/contactsService';
import {
  openDmChannel,
  fetchDmInbox,
  countDmInbox,
  subscribeToDmInbox,
} from '../../services/chatService';
import { usePresenceHeartbeat } from '../../hooks/usePresenceHeartbeat';
import ChatConversation from './ChatConversation';
import './chatTheme.css';
import './ChatWidget.css';

const PANEL_HEIGHT_KEY = 'dailyways_chat_panel_height';
const PANEL_POS_KEY = 'dailyways_chat_panel_pos';
const PANEL_PINNED_KEY = 'dailyways_chat_panel_pinned';
const DEFAULT_PANEL_HEIGHT = 560;
const MIN_PANEL_HEIGHT = 360;
const MAX_PANEL_HEIGHT = 720;
const DEFAULT_PANEL_W = 400;

export function openAppChat(detail = {}) {
  window.dispatchEvent(new CustomEvent('app-chat-open', { detail }));
}

function AvatarTiny({ profile }) {
  const photo = profile?.photo_url || null;
  const fallback = profile?.avatar || profile?.name?.[0] || '?';
  if (photo) return <img className="chat-avatar" src={photo} alt="avatar" />;
  return <div className="chat-avatar chat-avatar--fallback">{fallback}</div>;
}

function displayName(profile, fallbackId) {
  if (!profile) return fallbackId?.slice(0, 8) || 'Usuário';
  return profile.name || (profile.username ? `@${profile.username}` : fallbackId?.slice(0, 8));
}

export default function ChatWidget() {
  const { user } = useAuth();
  const myId = user?.id;

  const [isOpen, setIsOpen] = useState(false);
  const [pinned, setPinned] = useState(() => localStorage.getItem(PANEL_PINNED_KEY) === '1');
  const [listTab, setListTab] = useState('contacts');
  const [channel, setChannel] = useState(null);
  const [panelHeight, setPanelHeight] = useState(() => {
    const saved = Number(localStorage.getItem(PANEL_HEIGHT_KEY));
    return Number.isFinite(saved) && saved >= MIN_PANEL_HEIGHT ? saved : DEFAULT_PANEL_HEIGHT;
  });

  const [contacts, setContacts] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [inboxCount, setInboxCount] = useState(0);
  const [profilesById, setProfilesById] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const searchTimerRef = useRef(null);
  const resizeRef = useRef({ startY: 0, startH: DEFAULT_PANEL_HEIGHT });
  const panelRef = useRef(null);
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startLeft: 0, startTop: 0 });

  const [panelPos, setPanelPos] = useState(() => {
    try {
      const raw = localStorage.getItem(PANEL_POS_KEY);
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (typeof p?.left === 'number' && typeof p?.top === 'number') return p;
      return null;
    } catch {
      return null;
    }
  });

  usePresenceHeartbeat(!!user?.id);

  const ensureProfiles = useCallback(async (ids) => {
    const unique = [...new Set((ids || []).filter(Boolean))];
    if (!unique.length) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, username, name, avatar, photo_url')
      .in('id', unique);
    setProfilesById((prev) => {
      const next = new Map(prev);
      for (const p of data || []) next.set(p.id, p);
      return next;
    });
  }, []);

  const refreshInbox = useCallback(async () => {
    if (!myId) return;
    const [{ data }, { count }] = await Promise.all([fetchDmInbox(), countDmInbox()]);
    setInbox(data || []);
    setInboxCount(count?.count ?? 0);
    await ensureProfiles((data || []).map((r) => r.sender_id));
  }, [ensureProfiles, myId]);

  const refreshContacts = useCallback(async () => {
    if (!myId) return;
    const { data } = await fetchContacts();
    setContacts(data || []);
    await ensureProfiles((data || []).map((c) => c.contact_user_id));
  }, [ensureProfiles, myId]);

  useEffect(() => {
    refreshContacts();
    refreshInbox();
  }, [refreshContacts, refreshInbox]);

  useEffect(() => {
    if (!myId || !isOpen) return undefined;
    return subscribeToDmInbox(myId, refreshInbox);
  }, [isOpen, myId, refreshInbox]);

  useEffect(() => {
    const onContacts = () => refreshContacts();
    window.addEventListener('contacts-updated', onContacts);
    return () => window.removeEventListener('contacts-updated', onContacts);
  }, [refreshContacts]);

  const openWithUser = useCallback(async (otherUserId, opts = {}) => {
    if (!otherUserId) return;
    setError('');
    setLoading(true);

    if (opts.requestId) {
      setChannel({
        type: 'pending',
        requestId: opts.requestId,
        otherUserId,
        isSender: false,
      });
      setLoading(false);
      return;
    }

    const { data, error: e } = await openDmChannel(otherUserId);
    if (e) setError(e);
    else if (data?.mode === 'direct') {
      setChannel({ type: 'direct', conversationId: data.conversation_id, otherUserId });
    } else {
      setChannel({
        type: 'pending',
        requestId: data?.request_id || null,
        otherUserId,
        isSender: true,
      });
    }
    await ensureProfiles([otherUserId]);
    setLoading(false);
    setSearch('');
    setSuggestions([]);
  }, [ensureProfiles]);

  const openPanel = useCallback((detail = {}) => {
    setIsOpen(true);
    if (detail.inbox) setListTab('inbox');
    if (detail.conversationId) {
      setChannel({ type: 'direct', conversationId: detail.conversationId, otherUserId: detail.userId });
      return;
    }
    if (detail.requestId && detail.userId) {
      void openWithUser(detail.userId, { requestId: detail.requestId });
      return;
    }
    if (detail.userId) void openWithUser(detail.userId);
  }, [openWithUser]);

  useEffect(() => {
    const onOpen = (e) => openPanel(e.detail || {});
    window.addEventListener('app-chat-open', onOpen);
    return () => window.removeEventListener('app-chat-open', onOpen);
  }, [openPanel]);

  const handleSearchChange = (v) => {
    setSearch(v);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const q = (v || '').trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSuggestLoading(false);
      return;
    }
    setSuggestLoading(true);
    searchTimerRef.current = setTimeout(async () => {
      const { data, error: sErr } = await searchContactTargets(q, 8);
      if (sErr) setError(sErr);
      setSuggestions(data || []);
      setSuggestLoading(false);
    }, 220);
  };

  const sendRequestTo = async (targetId, targetLabel) => {
    const { success, data, error: sErr } = await sendContactRequest(targetId);
    if (!success) {
      setError(sErr || 'Erro ao enviar solicitação.');
      return;
    }
    if (data?.status === 'accepted') {
      window.dispatchEvent(new CustomEvent('contacts-updated'));
    }
    setSearch('');
    setSuggestions([]);
    refreshContacts();
  };

  const startResize = (e) => {
    e.preventDefault();
    resizeRef.current = { startY: e.clientY, startH: panelHeight };
    const onMove = (ev) => {
      const delta = resizeRef.current.startY - ev.clientY;
      const next = Math.min(MAX_PANEL_HEIGHT, Math.max(MIN_PANEL_HEIGHT, resizeRef.current.startH + delta));
      setPanelHeight(next);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      localStorage.setItem(PANEL_HEIGHT_KEY, String(panelHeight));
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  useEffect(() => {
    localStorage.setItem(PANEL_HEIGHT_KEY, String(panelHeight));
  }, [panelHeight]);

  useEffect(() => {
    localStorage.setItem(PANEL_PINNED_KEY, pinned ? '1' : '0');
  }, [pinned]);

  useEffect(() => {
    if (!panelPos) return;
    localStorage.setItem(PANEL_POS_KEY, JSON.stringify(panelPos));
  }, [panelPos]);

  const clampPos = useCallback((pos, height) => {
    const w = DEFAULT_PANEL_W;
    const h = height || panelHeight;
    const pad = 12;
    const maxLeft = Math.max(pad, window.innerWidth - w - pad);
    const maxTop = Math.max(pad, window.innerHeight - h - pad);
    return {
      left: Math.min(maxLeft, Math.max(pad, pos.left)),
      top: Math.min(maxTop, Math.max(pad, pos.top)),
    };
  }, [panelHeight]);

  // Default position (bottom-right above FAB cluster)
  useEffect(() => {
    if (!isOpen || panelPos) return;
    const pad = 20;
    const left = Math.max(pad, window.innerWidth - DEFAULT_PANEL_W - pad);
    const top = Math.max(pad, window.innerHeight - panelHeight - (pad + 64));
    setPanelPos({ left, top });
  }, [isOpen, panelHeight, panelPos]);

  // Close on outside click when not pinned
  useEffect(() => {
    if (!isOpen || pinned) return undefined;
    const onDown = (e) => {
      const el = panelRef.current;
      if (!el) return;
      if (el.contains(e.target)) return;
      setIsOpen(false);
      setChannel(null);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [isOpen, pinned]);

  const startDrag = (e) => {
    if (e.button !== 0) return;
    const target = e.target;
    if (target?.closest?.('button, input, textarea, a, select, label')) return;
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: rect.left,
      startTop: rect.top,
    };
    const onMove = (ev) => {
      if (!dragRef.current.dragging) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      const next = clampPos({ left: dragRef.current.startLeft + dx, top: dragRef.current.startTop + dy }, panelHeight);
      setPanelPos(next);
    };
    const onUp = () => {
      dragRef.current.dragging = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const contactRecord = channel?.otherUserId
    ? contacts.find((c) => c.contact_user_id === channel.otherUserId)
    : null;
  const otherProfile = channel?.otherUserId ? profilesById.get(channel.otherUserId) : null;

  if (!isOpen) {
    return (
      <button type="button" className="app-chat-fab" title="Chat" onClick={() => openPanel({})} aria-label="Abrir chat">
        <MessageCircle size={22} strokeWidth={2.25} />
        {inboxCount > 0 && (
          <span className="app-chat-fab-badge">{inboxCount > 9 ? '9+' : inboxCount}</span>
        )}
      </button>
    );
  }

  return (
    <div
      className="app-chat-panel chat-wa"
      ref={panelRef}
      style={{
        height: panelHeight,
        position: 'fixed',
        left: panelPos?.left ?? undefined,
        top: panelPos?.top ?? undefined,
        right: panelPos ? undefined : 20,
        bottom: panelPos ? undefined : 84,
      }}
      role="dialog"
      aria-label="Chat"
    >
      <div
        className="app-chat-resize-handle"
        onMouseDown={startResize}
        title="Arrastar para ajustar altura"
      />
      {!channel ? (
        <>
          <header className="app-chat-widget-header" onMouseDown={startDrag} title="Arraste para mover">
            <span className="app-chat-widget-brand"><Users size={16} /></span>
            <div className="app-chat-widget-titles">
              <h2 className="app-chat-widget-title">Chat</h2>
              <p className="app-chat-widget-sub">Mensagens com amigos</p>
            </div>
            <div className="app-chat-widget-actions">
              <button type="button" className="btn-icon btn-xs" onClick={() => setPinned((v) => !v)} title={pinned ? 'Desfixar' : 'Fixar'}>
                {pinned ? <PinOff size={18} /> : <Pin size={18} />}
              </button>
              <button type="button" className="btn-icon btn-xs" onClick={() => { setIsOpen(false); setChannel(null); }} title="Fechar">
                <X size={18} />
              </button>
            </div>
          </header>
          {error && <div className="app-chat-error">{error}</div>}
          <div className="app-chat-body app-chat-body--list">
            <div className="app-chat-tabs">
              <button type="button" className={`app-chat-tab${listTab === 'contacts' ? ' app-chat-tab--active' : ''}`} onClick={() => setListTab('contacts')}>
                <Users size={14} /> Contatos
              </button>
              <button type="button" className={`app-chat-tab${listTab === 'inbox' ? ' app-chat-tab--active' : ''}`} onClick={() => { setListTab('inbox'); refreshInbox(); }}>
                <Inbox size={14} /> Caixa de entrada
                {inboxCount > 0 && <span className="app-chat-tab-badge">{inboxCount}</span>}
              </button>
            </div>
            {listTab === 'contacts' && (
              <>
                <div className="app-chat-search">
                  <Search size={16} />
                  <input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Buscar email ou @username" />
                </div>
                {(suggestLoading || suggestions.length > 0) && (
                  <div className="app-chat-suggestions">
                    {suggestLoading && <div className="app-chat-suggestion muted">Buscando…</div>}
                    {!suggestLoading && suggestions.map((s) => (
                      <button key={s.id} type="button" className="app-chat-suggestion" onClick={() => openWithUser(s.id)}>
                        <AvatarTiny profile={s} />
                        <div className="app-chat-suggestion-text">
                          <strong>{s.name || `@${s.username}`}</strong>
                          <span>@{s.username}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <div className="app-chat-section-title">Amigos</div>
                <div className="app-chat-contacts">
                  {contacts.length === 0 ? (
                    <div className="app-chat-empty">Sem amigos ainda.</div>
                  ) : (
                    contacts.map((c) => {
                      const p = profilesById.get(c.contact_user_id);
                      return (
                        <button key={c.contact_user_id} type="button" className="app-chat-contact" onClick={() => openWithUser(c.contact_user_id)}>
                          <AvatarTiny profile={p} />
                          <div className="app-chat-contact-text">
                            <strong>{c.nickname || displayName(p, c.contact_user_id)}</strong>
                            <span>{p?.username ? `@${p.username}` : ''}</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}
            {listTab === 'inbox' && (
              <div className="app-chat-inbox">
                {inbox.length === 0 ? (
                  <div className="app-chat-empty">Caixa de entrada vazia.</div>
                ) : (
                  inbox.map((item) => {
                    const p = profilesById.get(item.sender_id);
                    return (
                      <button key={item.request_id} type="button" className="app-chat-inbox-item" onClick={() => openWithUser(item.sender_id, { requestId: item.request_id })}>
                        <AvatarTiny profile={p} />
                        <div className="app-chat-inbox-text">
                          <strong>{displayName(p, item.sender_id)}</strong>
                          <span className="app-chat-inbox-preview">{(item.preview || '').slice(0, 80)}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <ChatConversation
          channel={channel}
          myId={myId}
          profile={otherProfile}
          contactRecord={contactRecord}
          onBack={() => setChannel(null)}
          onChannelUpgrade={(next) => setChannel(next)}
          pinned={pinned}
          onTogglePinned={() => setPinned((v) => !v)}
          onClose={() => { setIsOpen(false); setChannel(null); }}
          isOpen={isOpen}
        />
      )}
      {loading && !channel && <div className="app-chat-loading-overlay">Abrindo…</div>}
    </div>
  );
}
