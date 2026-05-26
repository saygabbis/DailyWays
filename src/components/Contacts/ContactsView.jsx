import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabaseClient';
import {
  fetchContacts,
  fetchContactRequests,
  removeContact,
  respondToContactRequest,
  searchContactTargets,
  sendContactRequest,
  updateContact,
} from '../../services/contactsService';
import { blockUser } from '../../services/privacyService';
import {
  Users,
  Search,
  Plus,
  MessageCircle,
  Pin,
  PinOff,
  Trash2,
  Check,
  X,
  Ban,
  Mail,
  AtSign,
} from 'lucide-react';
import './ContactsView.css';

function Avatar({ profile }) {
  const photo = profile?.photo_url || null;
  const fallback = profile?.avatar || profile?.name?.[0] || '?';
  if (photo) return <img className="contacts-avatar-photo" src={photo} alt="avatar" />;
  return <div className="contacts-avatar-fallback">{fallback}</div>;
}

function profileDisplayName(p) {
  return p?.name || (p?.username ? `@${p.username}` : 'Usuário');
}

export default function ContactsView() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState([]);
  const [contactProfiles, setContactProfiles] = useState(new Map());
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const suggestTimerRef = useRef(null);

  const myId = user?.id;

  const incoming = useMemo(
    () => requests.filter((r) => r.to_user_id === myId && r.status === 'pending'),
    [requests, myId]
  );
  const outgoing = useMemo(
    () => requests.filter((r) => r.from_user_id === myId && r.status === 'pending'),
    [requests, myId]
  );

  const refresh = useCallback(async () => {
    if (!myId) return;
    setLoading(true);
    setError('');

    const [{ data: cData, error: cErr }, { data: rData, error: rErr }] = await Promise.all([
      fetchContacts(),
      fetchContactRequests(),
    ]);

    if (cErr || rErr) {
      setError(cErr || rErr || 'Erro ao carregar.');
    }

    const nextContacts = cData || [];
    const nextRequests = rData || [];
    setContacts(nextContacts);
    setRequests(nextRequests);

    const profileIds = new Set();
    nextContacts.forEach((c) => { if (c.contact_user_id) profileIds.add(c.contact_user_id); });
    nextRequests.forEach((r) => {
      if (r.from_user_id) profileIds.add(r.from_user_id);
      if (r.to_user_id) profileIds.add(r.to_user_id);
    });

    const ids = [...profileIds];
    if (ids.length > 0) {
      const { data: profs, error: pErr } = await supabase
        .from('profiles')
        .select('id, username, name, avatar, photo_url')
        .in('id', ids);
      if (!pErr && profs?.length) {
        const m = new Map();
        for (const p of profs) m.set(p.id, p);
        setContactProfiles(m);
      }
    }

    setLoading(false);
  }, [myId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!myId) return undefined;

    const onExternalRefresh = () => { refresh(); };
    window.addEventListener('contacts-updated', onExternalRefresh);
    window.addEventListener('notifications-updated', onExternalRefresh);
    window.addEventListener('focus', onExternalRefresh);

    const channel = supabase
      .channel(`contacts:${myId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'contacts',
          filter: `user_id=eq.${myId}`,
        },
        () => refresh()
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'contacts',
          filter: `user_id=eq.${myId}`,
        },
        () => refresh()
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'contact_requests',
          filter: `from_user_id=eq.${myId}`,
        },
        () => refresh()
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'contact_requests',
          filter: `to_user_id=eq.${myId}`,
        },
        () => refresh()
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'contact_requests',
          filter: `to_user_id=eq.${myId}`,
        },
        () => refresh()
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'contact_requests',
          filter: `from_user_id=eq.${myId}`,
        },
        () => refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('contacts-updated', onExternalRefresh);
      window.removeEventListener('notifications-updated', onExternalRefresh);
      window.removeEventListener('focus', onExternalRefresh);
    };
  }, [myId, refresh]);

  const handleQueryChange = (v) => {
    setQuery(v);
    setSuggestOpen(true);
    setSuggestions([]);
    setError('');

    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
    const next = (v || '').trim();
    if (next.length < 2) {
      setSuggestLoading(false);
      return;
    }
    setSuggestLoading(true);
    suggestTimerRef.current = setTimeout(async () => {
      const { data, error: sErr } = await searchContactTargets(next, 8);
      if (sErr) setError(sErr);
      setSuggestions(data || []);
      setSuggestLoading(false);
    }, 220);
  };

  const openChatWithUser = async (otherUserId) => {
    if (!otherUserId) return;
    window.dispatchEvent(new CustomEvent('app-chat-open', { detail: { userId: otherUserId } }));
  };

  const sendRequestTo = async (targetId, targetLabel) => {
    setError('');
    setSuccessMsg('');
    const { success, data, error: sErr } = await sendContactRequest(targetId);
    if (!success) {
      const msg = sErr || 'Erro ao enviar solicitação.';
      if (msg.includes('already_contacts')) {
        setError('Vocês já são amigos.');
      } else {
        setError(msg);
      }
      return;
    }
    if (data) {
      setRequests((prev) => {
        const rest = prev.filter((r) => r.id !== data.id);
        return [data, ...rest];
      });
    }
    const becameFriends = data?.status === 'accepted';
    setSuccessMsg(
      becameFriends
        ? (targetLabel
          ? `Vocês e ${targetLabel} já são amigos (pedidos cruzados).`
          : 'Pedido aceito automaticamente — vocês já são amigos.')
        : (targetLabel
          ? `Solicitação enviada para ${targetLabel}. Aguardando aceite.`
          : 'Solicitação enviada. Aguardando aceite.')
    );
    setTimeout(() => setSuccessMsg(''), 4000);
    setQuery('');
    setSuggestions([]);
    setSuggestOpen(false);
    refresh();
    if (becameFriends) {
      window.dispatchEvent(new CustomEvent('contacts-updated'));
    }
  };

  const handleAccept = async (requestId) => {
    setError('');
    const { success, error: sErr } = await respondToContactRequest(requestId, 'accepted');
    if (!success) setError(sErr || 'Erro ao aceitar.');
    refresh();
  };

  const handleDecline = async (requestId) => {
    setError('');
    const { success, error: sErr } = await respondToContactRequest(requestId, 'declined');
    if (!success) setError(sErr || 'Erro ao recusar.');
    refresh();
  };

  const handleBlockFromRequest = async (request) => {
    setError('');
    const otherId = request?.from_user_id;
    if (otherId) await blockUser(otherId);
    if (request?.id) await respondToContactRequest(request.id, 'blocked');
    refresh();
  };

  const togglePinned = async (contactUserId, pinned) => {
    setError('');
    const { success, error: sErr } = await updateContact(contactUserId, { pinned: !pinned });
    if (!success) setError(sErr || 'Erro ao atualizar contato.');
    refresh();
  };

  const handleRemove = async (contactUserId) => {
    setError('');
    const { success, error: sErr } = await removeContact(contactUserId);
    if (!success) setError(sErr || 'Erro ao remover contato.');
    refresh();
  };

  const isAlreadyContact = (targetId) => contacts.some((c) => c.contact_user_id === targetId);
  const hasOutgoingTo = (targetId) => outgoing.some((r) => r.to_user_id === targetId);

  return (
    <div className="contacts-view animate-slide-up">
      <header className="contacts-header">
        <div className="contacts-header-left">
          <Users size={18} />
          <div>
            <h2>Contatos</h2>
            <p>Amigos mútuos — se alguém te remover, some da lista automaticamente</p>
          </div>
        </div>
      </header>

      {error && <div className="contacts-error">{error}</div>}
      {successMsg && <div className="contacts-success">{successMsg}</div>}

      <div className="contacts-grid">
        <section className="contacts-card">
          <div className="contacts-card-head">
            <h3>Adicionar contato</h3>
          </div>

          <div className="contacts-search">
            <Search size={16} className="contacts-search-icon" />
            <input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Digite email ou @username"
              onFocus={() => setSuggestOpen(true)}
            />
            <span className="contacts-search-hint">
              {query.includes('@') ? <Mail size={14} /> : <AtSign size={14} />}
            </span>
          </div>

          {suggestOpen && (suggestLoading || suggestions.length > 0 || (query.trim().length >= 2)) && (
            <div className="contacts-suggest">
              {suggestLoading && <div className="contacts-suggest-item muted">Buscando…</div>}
              {!suggestLoading && suggestions.length === 0 && query.trim().length >= 2 && (
                <div className="contacts-suggest-item muted">Nenhum usuário encontrado</div>
              )}
              {!suggestLoading && suggestions.map((s) => {
                const disabled = isAlreadyContact(s.id) || hasOutgoingTo(s.id);
                const label = isAlreadyContact(s.id)
                  ? 'Já é contato'
                  : hasOutgoingTo(s.id)
                    ? 'Solicitado'
                    : 'Adicionar';
                return (
                  <div key={s.id} className="contacts-suggest-item">
                    <div className="contacts-suggest-user">
                      <Avatar profile={s} />
                      <div className="contacts-suggest-user-text">
                        <strong>{s.name || `@${s.username}`}</strong>
                        <span>@{s.username}{s.email ? ` · ${s.email}` : ''}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`btn btn-sm ${disabled ? 'btn-ghost' : 'btn-primary'}`}
                      onClick={() => !disabled && sendRequestTo(s.id, s.name || `@${s.username}`)}
                      disabled={disabled}
                    >
                      <Plus size={14} />
                      {label}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="contacts-card">
          <div className="contacts-card-head">
            <h3>Amigos</h3>
            <span className="contacts-badge">{contacts.length}</span>
          </div>

          {loading ? (
            <p className="contacts-muted">Carregando…</p>
          ) : contacts.length === 0 ? (
            <p className="contacts-muted">Você ainda não adicionou nenhum contato.</p>
          ) : (
            <div className="contacts-list">
              {contacts.map((c) => {
                const p = contactProfiles.get(c.contact_user_id);
                return (
                  <div key={c.contact_user_id} className="contacts-item">
                    <div className="contacts-item-left">
                      <Avatar profile={p} />
                      <div className="contacts-item-text">
                        <strong>{profileDisplayName(p)}</strong>
                        <span>{p?.username ? `@${p.username}` : c.contact_user_id}</span>
                      </div>
                    </div>
                    <div className="contacts-item-actions">
                      <button
                        type="button"
                        className="btn btn-xs btn-ghost"
                        title={c.pinned ? 'Desafixar' : 'Fixar'}
                        onClick={() => togglePinned(c.contact_user_id, !!c.pinned)}
                      >
                        {c.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs btn-primary"
                        onClick={() => openChatWithUser(c.contact_user_id)}
                        title="Abrir chat"
                      >
                        <MessageCircle size={14} />
                        Chat
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs btn-danger"
                        onClick={() => handleRemove(c.contact_user_id)}
                        title="Remover"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="contacts-card">
          <div className="contacts-card-head">
            <h3>Solicitações</h3>
            <span className="contacts-badge">{incoming.length + outgoing.length}</span>
          </div>

          <div className="contacts-requests">
            <div className="contacts-requests-col">
              <h4>Recebidas</h4>
              {incoming.length === 0 ? (
                <p className="contacts-muted">Sem solicitações.</p>
              ) : (
                incoming.map((r) => {
                  const p = contactProfiles.get(r.from_user_id);
                  return (
                  <div key={r.id} className="contacts-request">
                    <div className="contacts-request-text">
                      <strong>{profileDisplayName(p)}</strong>
                      <span>{p?.username ? `@${p.username}` : `ID ${r.from_user_id.slice(0, 8)}…`}</span>
                    </div>
                    <div className="contacts-request-actions">
                      <button type="button" className="btn btn-xs btn-primary" onClick={() => handleAccept(r.id)}>
                        <Check size={14} /> Aceitar
                      </button>
                      <button type="button" className="btn btn-xs btn-ghost" onClick={() => handleDecline(r.id)}>
                        <X size={14} /> Recusar
                      </button>
                      <button type="button" className="btn btn-xs btn-danger" onClick={() => handleBlockFromRequest(r)}>
                        <Ban size={14} /> Bloquear
                      </button>
                    </div>
                  </div>
                  );
                })
              )}
            </div>

            <div className="contacts-requests-col">
              <h4>Enviadas</h4>
              {outgoing.length === 0 ? (
                <p className="contacts-muted">Nenhuma enviada.</p>
              ) : (
                outgoing.map((r) => {
                  const p = contactProfiles.get(r.to_user_id);
                  return (
                  <div key={r.id} className="contacts-request">
                    <div className="contacts-request-text">
                      <strong>{profileDisplayName(p)}</strong>
                      <span>{p?.username ? `@${p.username}` : `ID ${r.to_user_id.slice(0, 8)}…`}</span>
                    </div>
                    <div className="contacts-request-actions">
                      <span className="contacts-pill">Aguardando aceite</span>
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

