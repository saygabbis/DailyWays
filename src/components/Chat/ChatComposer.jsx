import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Smile, SendHorizonal, X } from 'lucide-react';

const EMOJI_QUICK = ['😀', '😂', '❤️', '👍', '🙏', '🔥', '😍', '🎉', '😢', '🤔', '👏', '💯'];
const EMOJI_ALL = [
  '😀','😁','😂','🤣','😊','😍','😘','😎','🤔','😴','😡','🥹','😢','😭','😮','😱','🥳','🤯','😇','🤩',
  '👍','👎','👏','🙏','🤝','💪','🫶','👀','💯','✅','❌','⚠️','🔥','✨','🎉','🎯','💡','💬','🧠',
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','💖','💘',
  '😂','😅','🙃','😉','😋','😜','🤗','🫠','🫡','🤨','😐','🙄',
  '🍕','🍔','🍟','🍣','🍜','☕','🍺','🍫','🍩',
  '⚽','🏀','🎮','🎵','🎬','📷','🧩','🎨',
  '🚀','🏠','📌','🔒','🔓','🔔','🔕','🛠️','🧹','🗑️',
];

export default function ChatComposer({
  draft,
  onDraftChange,
  onSend,
  onImagePick,
  disabled,
  sending = false,
  placeholder = 'Mensagem',
  focusKey,
}) {
  const fileRef = useRef(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiQuery, setEmojiQuery] = useState('');
  const inputRef = useRef(null);
  const wasSendingRef = useRef(false);

  const keepComposerFocus = () => {
    // Keep typing flow after send/upload actions.
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const triggerSend = () => {
    if (sending || disabled) return;
    onSend?.();
    keepComposerFocus();
  };

  useEffect(() => {
    if (wasSendingRef.current && !sending && !disabled) {
      keepComposerFocus();
    }
    wasSendingRef.current = sending;
  }, [disabled, sending]);

  useEffect(() => {
    if (!disabled) keepComposerFocus();
  }, [disabled, focusKey]);

  const insertEmoji = (emoji) => {
    const el = inputRef.current;
    if (!el) {
      onDraftChange((draft || '') + emoji);
      return;
    }
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const next = `${(draft || '').slice(0, start)}${emoji}${(draft || '').slice(end)}`;
    onDraftChange(next);
    setEmojiOpen(false);
  };

  const emojiList = useMemo(() => {
    const q = (emojiQuery || '').trim().toLowerCase();
    if (!q) return EMOJI_ALL;
    // Busca simples (por copiar/colar emoji no input). Se não for emoji, não filtra.
    return EMOJI_ALL.filter((e) => e.includes(q));
  }, [emojiQuery]);

  return (
    <div className="chat-composer">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="chat-composer-file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImagePick?.(f);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        className="chat-composer-icon"
        title="Anexar imagem"
        onClick={() => fileRef.current?.click()}
        disabled={disabled}
      >
        <Plus size={20} />
      </button>
      <div className="chat-composer-input-wrap">
        {emojiOpen && (
          <div className="chat-emoji-picker">
            <button type="button" className="chat-emoji-close" onClick={() => setEmojiOpen(false)}>
              <X size={14} />
            </button>
            <input
              className="chat-emoji-search"
              value={emojiQuery}
              onChange={(e) => setEmojiQuery(e.target.value)}
              placeholder="Filtrar (cole um emoji)…"
            />
            <div className="chat-emoji-grid">
              {(emojiList.length ? emojiList : EMOJI_QUICK).map((e) => (
                <button key={e} type="button" className="chat-emoji-btn" onClick={() => insertEmoji(e)}>
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}
        <textarea
          ref={inputRef}
          rows={1}
          className="chat-composer-input"
          value={draft}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onDraftChange(e.target.value)}
          onPaste={(e) => {
            if (!onImagePick) return;
            const items = Array.from(e.clipboardData?.items || []);
            const imageItem = items.find((item) => item.kind === 'file' && item.type.startsWith('image/'));
            const imageFile = imageItem?.getAsFile?.();
            if (!imageFile) return;
            e.preventDefault();
            onImagePick(imageFile);
            keepComposerFocus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !sending && !disabled) {
              e.preventDefault();
              triggerSend();
            }
          }}
        />
      </div>
      <button
        type="button"
        className="chat-composer-icon"
        title="Emoji"
        onClick={() => setEmojiOpen((v) => !v)}
        disabled={disabled}
      >
        <Smile size={20} />
      </button>
      <button
        type="button"
        className="chat-composer-send"
        onMouseDown={(e) => e.preventDefault()}
        onClick={triggerSend}
        disabled={disabled || sending || !(draft || '').trim()}
        title="Enviar"
      >
        <SendHorizonal size={20} />
      </button>
    </div>
  );
}
