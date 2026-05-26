import { useEffect, useRef } from 'react';
import ChatMessageBubble from './ChatMessageBubble';

export default function ChatMessageList({
  messages,
  myId,
  loading,
  onContextMenu,
  onReactionClick,
  onScrollState,
}) {
  const bottomRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    onScrollState?.(atBottom);
  };

  return (
    <div className="chat-messages" ref={listRef} onScroll={handleScroll}>
      {loading && <div className="chat-empty">Carregando…</div>}
      {!loading && messages.length === 0 && (
        <div className="chat-empty">Nenhuma mensagem ainda. Diga olá!</div>
      )}
      {messages.map((m) => (
        <ChatMessageBubble
          key={m.id}
          message={m}
          mine={m.sender_id === myId}
          onContextMenu={onContextMenu}
          onReactionClick={onReactionClick}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
