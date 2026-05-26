import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Settings, Check, Pin, PinOff, X } from 'lucide-react';
import { useChatMessages } from '../../hooks/useChatMessages';
import {
  uploadChatImage,
  checkUserOnline,
  editChatMessage,
  deleteChatMessage,
  hideMessageForMe,
  clearChatHistoryForMe,
  toggleMessageReaction,
  acceptDmRequest,
  declineDmRequest,
  sendDmMessage,
  fetchDmRequestMessages,
  subscribeToDmRequest,
} from '../../services/chatService';
import ChatMessageList from './ChatMessageList';
import ChatComposer from './ChatComposer';
import ChatContactDrawer from './ChatContactDrawer';

const REACT_EMOJI = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

function Avatar({ profile }) {
  const photo = profile?.photo_url;
  const fallback = profile?.avatar || profile?.name?.[0] || '?';
  if (photo) return <img className="chat-avatar chat-avatar--lg" src={photo} alt="" />;
  return <div className="chat-avatar chat-avatar--lg chat-avatar--fallback">{fallback}</div>;
}

export default function ChatConversation({
  channel,
  myId,
  profile,
  contactRecord,
  onBack,
  onChannelUpgrade,
  pinned,
  onTogglePinned,
  onClose,
  isOpen,
}) {
  const [draft, setDraft] = useState('');
  const [online, setOnline] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menu, setMenu] = useState(null);
  const [pendingMessages, setPendingMessages] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const isDirect = channel?.type === 'direct';
  const isPending = channel?.type === 'pending';
  const isPendingRecipient = isPending && !channel?.isSender;
  const conversationId = isDirect ? channel.conversationId : null;

  const scrollToBottom = useCallback(() => {}, []);

  const {
    messages,
    loading,
    error: msgError,
    setError: setMsgError,
    sendText,
    sendImage,
    setAtBottom,
    refreshReceipts,
    reload,
  } = useChatMessages(conversationId, {
    enabled: isDirect && isOpen,
    myId,
    onNewMessage: scrollToBottom,
  });

  useEffect(() => {
    setError(msgError || '');
  }, [msgError]);

  useEffect(() => {
    if (!channel?.otherUserId) return;
    checkUserOnline(channel.otherUserId).then(setOnline);
    const id = setInterval(() => {
      checkUserOnline(channel.otherUserId).then(setOnline);
    }, 20000);
    return () => clearInterval(id);
  }, [channel?.otherUserId]);

  const loadPending = useCallback(async () => {
    if (!channel?.requestId) return;
    setPendingLoading(true);
    const { data, error: e } = await fetchDmRequestMessages(channel.requestId);
    if (e) setError(e);
    setPendingMessages(data || []);
    setPendingLoading(false);
  }, [channel?.requestId]);

  useEffect(() => {
    if (isPending && channel?.requestId) loadPending();
  }, [isPending, channel?.requestId, loadPending]);

  useEffect(() => {
    if (!isPending || !channel?.requestId) return undefined;
    return subscribeToDmRequest(channel.requestId, loadPending);
  }, [isPending, channel?.requestId, loadPending]);

  useEffect(() => {
    if (isDirect && conversationId && isOpen) {
      window.dispatchEvent(new CustomEvent('app-chat-active', {
        detail: { conversationId },
      }));
    }
    return () => {
      window.dispatchEvent(new CustomEvent('app-chat-active', { detail: { conversationId: null } }));
    };
  }, [conversationId, isDirect, isOpen]);

  const displayTitle = contactRecord?.nickname
    || profile?.name
    || (profile?.username ? `@${profile.username}` : 'Conversa');

  const handleSend = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    if (isDirect) {
      await sendText(body);
      return;
    }
    if (isPending && channel?.otherUserId) {
      const { success, error: e } = await sendDmMessage(channel.otherUserId, body);
      if (!success) setError(e || 'Erro ao enviar');
      else {
        setInfo('Mensagem enviada — aguardando aceite.');
        loadPending();
      }
    }
  };

  const handleImage = async (file) => {
    if (!conversationId || !file) return;
    setMsgError('');
    const { url, meta, error: upErr } = await uploadChatImage(conversationId, file);
    if (upErr) {
      setMsgError(upErr);
      return;
    }
    await sendImage(url, meta, draft.trim());
    setDraft('');
  };

  const handleContextMenu = (message) => {
    setMenu({ message });
  };

  const runMenuAction = async (action) => {
    const m = menu?.message;
    setMenu(null);
    if (!m?.id || m.id.startsWith('temp')) return;
    if (action === 'copy') {
      navigator.clipboard?.writeText(m.body || '');
      return;
    }
    if (action === 'edit') {
      const next = window.prompt('Editar mensagem:', m.body || '');
      if (next?.trim()) await editChatMessage(m.id, next.trim());
      await reload();
      return;
    }
    if (action === 'delete') await deleteChatMessage(m.id);
    if (action === 'hide') await hideMessageForMe(m.id);
    if (action === 'clear') await clearChatHistoryForMe(conversationId);
    if (action.startsWith('react:')) await toggleMessageReaction(m.id, action.slice(6));
    await reload();
  };

  const listMessages = isDirect ? messages : pendingMessages.map((m) => ({
    ...m,
    message_type: 'text',
    reactions: [],
  }));

  return (
    <div className="chat-conversation chat-wa">
      <header className="chat-conv-header" title="Arraste para mover">
        <button type="button" className="btn-icon btn-xs" onClick={onBack}>
          <ChevronLeft size={20} />
        </button>
        <Avatar profile={profile} />
        <div className="chat-conv-header-text">
          <strong>{displayTitle}</strong>
          <span>{online ? 'online' : isPendingRecipient ? 'mensagem pendente' : 'mensagens protegidas'}</span>
        </div>
        <div className="chat-conv-header-actions">
          {isDirect && (
            <button type="button" className="btn-icon btn-xs" onClick={() => setDrawerOpen(true)} title="Configurações">
              <Settings size={18} />
            </button>
          )}
          {onTogglePinned && (
            <button type="button" className="btn-icon btn-xs" onClick={onTogglePinned} title={pinned ? 'Desfixar' : 'Fixar'}>
              {pinned ? <PinOff size={18} /> : <Pin size={18} />}
            </button>
          )}
          {onClose && (
            <button type="button" className="btn-icon btn-xs" onClick={onClose} title="Fechar">
              <X size={18} />
            </button>
          )}
        </div>
      </header>

      {(error || info) && (
        <div className="chat-banner-info">{error || info}</div>
      )}

      {isPendingRecipient && (
        <div className="chat-pending-banner">
          <p>Esta pessoa quer ser seu contato. Aceite para conversar.</p>
          <div className="chat-pending-actions">
            <button type="button" className="btn btn-sm" onClick={async () => {
              await declineDmRequest(channel.requestId);
              onBack();
            }}>Recusar</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={async () => {
              const { data, error: e } = await acceptDmRequest(channel.requestId);
              if (e) setError(e);
              else if (data?.conversation_id) {
                window.dispatchEvent(new CustomEvent('contacts-updated'));
                onChannelUpgrade?.({
                  type: 'direct',
                  conversationId: data.conversation_id,
                  otherUserId: channel.otherUserId,
                });
              }
            }}>
              <Check size={14} /> Aceitar
            </button>
          </div>
        </div>
      )}

      {isPending && channel?.isSender && (
        <div className="chat-banner-info">
          Aguardando aceite — suas mensagens ficam na caixa de entrada dela(e).
        </div>
      )}

      <ChatMessageList
        messages={listMessages}
        myId={myId}
        loading={isDirect ? loading : pendingLoading}
        onContextMenu={handleContextMenu}
        onReactionClick={(m, emoji) => toggleMessageReaction(m.id, emoji).then(refreshReceipts)}
        onScrollState={setAtBottom}
      />

      {(isDirect || (isPending && channel?.isSender)) && (
        <ChatComposer
          draft={draft}
          onDraftChange={setDraft}
          onSend={handleSend}
          onImagePick={isDirect ? handleImage : undefined}
          disabled={isPendingRecipient}
          placeholder={isPending ? 'Mensagem pendente…' : 'Mensagem'}
        />
      )}

      {menu && (
        <div className="chat-ctx-menu">
          <button type="button" onClick={() => runMenuAction('copy')}>Copiar</button>
          {menu.message.sender_id === myId && !menu.message.deleted_at && (
            <button type="button" onClick={() => runMenuAction('edit')}>Editar</button>
          )}
          {menu.message.sender_id === myId && (
            <button type="button" onClick={() => runMenuAction('delete')}>Apagar para todos</button>
          )}
          <button type="button" onClick={() => runMenuAction('hide')}>Apagar para mim</button>
          {isDirect && (
            <button type="button" onClick={() => runMenuAction('clear')}>Limpar histórico (eu)</button>
          )}
          <div className="chat-ctx-reactions">
            {REACT_EMOJI.map((e) => (
              <button key={e} type="button" onClick={() => runMenuAction(`react:${e}`)}>{e}</button>
            ))}
          </div>
          <button type="button" onClick={() => setMenu(null)}>Fechar</button>
        </div>
      )}

      <ChatContactDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        contactUserId={channel?.otherUserId}
        profile={profile}
        initialNickname={contactRecord?.nickname}
        initialNotify={contactRecord?.notify_messages}
        conversationId={conversationId}
      />
    </div>
  );
}
