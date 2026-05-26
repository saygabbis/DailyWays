import { Check, CheckCheck } from 'lucide-react';

function formatTime(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function DeliveryTicks({ message, mine }) {
  if (!mine) return null;
  const status = message._localStatus;
  if (status === 'sending') {
    return <span className="chat-ticks chat-ticks--pending">···</span>;
  }
  const read = message.peer_read_at;
  const delivered = message.peer_delivered_at;
  if (read) {
    return <CheckCheck size={14} className="chat-ticks chat-ticks--read" />;
  }
  if (delivered) {
    return <CheckCheck size={14} className="chat-ticks" />;
  }
  return <Check size={14} className="chat-ticks" />;
}

function groupReactions(reactions) {
  if (!Array.isArray(reactions)) return [];
  const map = new Map();
  for (const r of reactions) {
    const e = r.emoji;
    if (!e) continue;
    map.set(e, (map.get(e) || 0) + 1);
  }
  return [...map.entries()];
}

export default function ChatMessageBubble({
  message,
  mine,
  onContextMenu,
  onReactionClick,
}) {
  const deleted = !!message.deleted_at;
  const isImage = message.message_type === 'image' && message.attachment_url;
  const reactionGroups = groupReactions(message.reactions);

  return (
    <div
      className={`chat-msg ${mine ? 'chat-msg--mine' : 'chat-msg--theirs'}`}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(message, e);
      }}
    >
      <div className="chat-msg__bubble">
        {deleted ? (
          <span className="chat-msg__deleted">Mensagem apagada</span>
        ) : isImage ? (
          <a href={message.attachment_url} target="_blank" rel="noreferrer" className="chat-msg__image-link">
            <img src={message.attachment_url} alt="" className="chat-msg__image" />
          </a>
        ) : null}
        {!deleted && message.body ? (
          <span className="chat-msg__text">{message.body}</span>
        ) : null}
        <div className="chat-msg__meta">
          {message.edited_at && !deleted && (
            <span className="chat-msg__edited">editada</span>
          )}
          <span className="chat-msg__time">{formatTime(message.created_at)}</span>
          <DeliveryTicks message={message} mine={mine} />
        </div>
      </div>
      {reactionGroups.length > 0 && (
        <div className="chat-msg__reactions">
          {reactionGroups.map(([emoji, count]) => (
            <button
              key={emoji}
              type="button"
              className="chat-msg__reaction-pill"
              onClick={() => onReactionClick?.(message, emoji)}
            >
              {emoji}{count > 1 ? ` ${count}` : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
