import { useEffect, useMemo, useState } from 'react';
import { Ban, Trash2, UserMinus, X } from 'lucide-react';
import { updateContact, removeContact } from '../../services/contactsService';
import { blockUser } from '../../services/privacyService';
import { clearChatHistoryForMe } from '../../services/chatService';

export default function ChatContactDrawer({
  open,
  onClose,
  contactUserId,
  profile,
  initialNickname,
  initialNotify,
  conversationId,
}) {
  const [nickname, setNickname] = useState(initialNickname || '');
  const [notify, setNotify] = useState(initialNotify !== false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const display = useMemo(() => (
    profile?.name || (profile?.username ? `@${profile.username}` : 'Contato')
  ), [profile?.name, profile?.username]);

  useEffect(() => {
    setNickname(initialNickname || '');
    setNotify(initialNotify !== false);
    setErr('');
  }, [initialNickname, initialNotify, open]);

  const save = async () => {
    if (!contactUserId) return;
    setSaving(true);
    setErr('');
    await updateContact(contactUserId, {
      nickname: nickname.trim() || null,
      notify_messages: notify,
    });
    setSaving(false);
    window.dispatchEvent(new CustomEvent('contacts-updated'));
    onClose?.();
  };

  const handleClear = async () => {
    if (!conversationId) {
      setErr('Não foi possível limpar o histórico desta conversa.');
      return;
    }
    const ok = window.confirm('Limpar todo o histórico desta conversa apenas para você?');
    if (!ok) return;
    const { success, error } = await clearChatHistoryForMe(conversationId);
    if (!success) setErr(error || 'Erro ao limpar histórico.');
    else onClose?.();
  };

  const handleRemoveContact = async () => {
    const ok = window.confirm('Remover este contato?');
    if (!ok) return;
    const { success, error } = await removeContact(contactUserId);
    if (!success) setErr(error || 'Erro ao remover contato.');
    window.dispatchEvent(new CustomEvent('contacts-updated'));
    onClose?.();
  };

  const handleBlock = async () => {
    const ok = window.confirm('Bloquear este contato? Ele não poderá mais te enviar solicitações/DM.');
    if (!ok) return;
    const { success, error } = await blockUser(contactUserId);
    if (!success) setErr(error || 'Erro ao bloquear.');
    window.dispatchEvent(new CustomEvent('contacts-updated'));
    onClose?.();
  };

  if (!open) return null;

  return (
    <div className="chat-drawer-backdrop" onClick={onClose}>
      <div className="chat-drawer" onClick={(e) => e.stopPropagation()}>
        <header className="chat-drawer-header">
          <h3>Configurar contato</h3>
          <button type="button" className="btn-icon btn-xs" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <p className="chat-drawer-sub">{display}</p>
        {err ? <div className="chat-drawer-error">{err}</div> : null}
        <label className="chat-drawer-field">
          Apelido
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Como quer ver no chat"
          />
        </label>

        <div className="chat-drawer-toggle-row">
          <div className="chat-drawer-toggle-info">
            <strong>Notificações</strong>
            <span>Receber popup/alerta para este contato</span>
          </div>
          <button
            type="button"
            className={`settings-toggle ${notify ? 'active' : ''}`}
            onClick={() => setNotify((v) => !v)}
            aria-label="Alternar notificações"
          >
            <div className="settings-toggle-thumb" />
          </button>
        </div>

        <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
          Salvar
        </button>

        <div className="chat-drawer-divider" />
        <div className="chat-drawer-actions">
          <button type="button" className="btn btn-sm" onClick={handleClear} disabled={saving}>
            <Trash2 size={16} /> Apagar todas as mensagens (eu)
          </button>
          <button type="button" className="btn btn-sm" onClick={handleRemoveContact} disabled={saving}>
            <UserMinus size={16} /> Remover contato
          </button>
          <button type="button" className="btn btn-sm chat-btn-danger" onClick={handleBlock} disabled={saving}>
            <Ban size={16} /> Bloquear contato
          </button>
        </div>
      </div>
    </div>
  );
}
