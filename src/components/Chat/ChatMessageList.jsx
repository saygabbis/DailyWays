import { useEffect, useRef } from 'react';
import ChatMessageBubble from './ChatMessageBubble';

export default function ChatMessageList({
  messages,
  myId,
  loading,
  loadingOlder,
  hasMore,
  onLoadOlder,
  onContextMenu,
  onReactionClick,
  onScrollState,
}) {
  const bottomRef = useRef(null);
  const listRef = useRef(null);
  const atBottomRef = useRef(true);
  const prevLengthRef = useRef(0);
  const prependSnapshotRef = useRef(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const isInitialPaint = prevLengthRef.current === 0;
    const prependSnapshot = prependSnapshotRef.current;

    if (prependSnapshot) {
      const delta = el.scrollHeight - prependSnapshot.scrollHeight;
      el.scrollTop = prependSnapshot.scrollTop + delta;
      prependSnapshotRef.current = null;
      prevLengthRef.current = messages.length;
      return;
    }

    if (isInitialPaint) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    } else if (atBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }

    prevLengthRef.current = messages.length;
  }, [messages.length]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    atBottomRef.current = atBottom;
    onScrollState?.(atBottom);
    if (hasMore && !loadingOlder && el.scrollTop < 72) {
      prependSnapshotRef.current = {
        scrollHeight: el.scrollHeight,
        scrollTop: el.scrollTop,
      };
      onLoadOlder?.();
    }
  };

  return (
    <div className="chat-messages" ref={listRef} onScroll={handleScroll}>
      {loadingOlder && <div className="chat-empty">Carregando mensagens antigas…</div>}
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
