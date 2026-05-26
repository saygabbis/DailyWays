import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  MessageCircle,
  Check,
  X,
} from 'lucide-react';
import './FloatingInvitationToast.css';

function pickNewest(list) {
  return [...list].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  )[0];
}

const PERSON_TYPES = new Set([
  'contact_request',
  'contact_accepted',
  'contact_declined',
  'chat_message',
]);

function toastHasActions(notification) {
  return notification?.type === 'contact_request' || notification?.type === 'invitation';
}

function markToastRead(notification) {
  if (!notification) return;
  window.dispatchEvent(new CustomEvent('app-notification-mark-read', {
    detail: { notification },
  }));
}

function NotificationAvatar({ notification }) {
  if (PERSON_TYPES.has(notification.type)) {
    const photo = notification.senderPhotoUrl;
    const fallback = notification.senderAvatar || notification.senderName?.[0] || '?';
    if (photo) {
      return <img src={photo} alt="" className="floating-notification-toast-photo" />;
    }
    return <div className="floating-notification-toast-photo-fallback">{fallback}</div>;
  }
  const emoji = notification.kind === 'space'
    ? (notification.spaceEmoji || '🌌')
    : (notification.boardEmoji || '📋');
  return <div className="floating-notification-toast-emoji">{emoji}</div>;
}

/** Popup clicável: abrir destino, aceitar ou recusar quando aplicável. */
export default function FloatingInvitationToast() {
  const [toast, setToast] = useState(null);
  const [acting, setActing] = useState(false);
  const timerRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    setToast(null);
    setActing(false);
  }, [clearTimer]);

  const scheduleDismiss = useCallback((ms = 10000) => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      setToast(null);
      setActing(false);
    }, ms);
  }, [clearTimer]);

  useEffect(() => {
    const onNew = (e) => {
      const list = e.detail?.notifications || e.detail?.invitations;
      if (!list?.length) return;
      setActing(false);
      setToast(pickNewest(list));
      scheduleDismiss(10000);
    };
    window.addEventListener('notifications-new', onNew);
    return () => window.removeEventListener('notifications-new', onNew);
  }, [scheduleDismiss]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const handleOpen = useCallback(() => {
    if (!toast || acting) return;
    markToastRead(toast);
    window.dispatchEvent(new CustomEvent('app-notification-open', {
      detail: { notification: toast },
    }));
    dismiss();
  }, [acting, dismiss, toast]);

  const handleAccept = useCallback((e) => {
    e.stopPropagation();
    if (!toast || acting) return;
    setActing(true);
    clearTimer();
    markToastRead(toast);
    window.dispatchEvent(new CustomEvent('app-notification-accept', {
      detail: { notification: toast },
    }));
    dismiss();
  }, [acting, clearTimer, dismiss, toast]);

  const handleDecline = useCallback((e) => {
    e.stopPropagation();
    if (!toast || acting) return;
    setActing(true);
    clearTimer();
    markToastRead(toast);
    window.dispatchEvent(new CustomEvent('app-notification-decline', {
      detail: { notification: toast },
    }));
    dismiss();
  }, [acting, clearTimer, dismiss, toast]);

  const handleClose = useCallback((e) => {
    e.stopPropagation();
    if (toast) markToastRead(toast);
    dismiss();
  }, [dismiss, toast]);

  if (!toast) return null;

  const who = toast.senderName || (toast.senderUsername ? `@${toast.senderUsername}` : 'Alguém');
  const showActions = toastHasActions(toast);

  const configByType = {
    contact_request: {
      title: 'Novo pedido de contato',
      Icon: UserPlus,
      mainLine: who,
      metaLine: 'Quer adicionar você aos contatos',
    },
    contact_accepted: {
      title: 'Pedido aceito',
      Icon: UserCheck,
      mainLine: who,
      metaLine: 'Aceitou seu pedido de contato',
    },
    contact_declined: {
      title: 'Pedido recusado',
      Icon: UserX,
      mainLine: who,
      metaLine: 'Recusou seu pedido de contato',
    },
    chat_message: {
      title: 'Nova mensagem',
      Icon: MessageCircle,
      mainLine: who,
      metaLine: toast.messagePreview || 'Enviou uma mensagem',
    },
    invitation: {
      title: 'Novo convite',
      Icon: Users,
      mainLine: `${toast.kind === 'space' ? toast.spaceEmoji : toast.boardEmoji} ${
        toast.kind === 'space' ? (toast.spaceTitle || 'Space') : (toast.boardTitle || 'Board')
      }`,
      metaLine: `Acesso como ${toast.role === 'editor' ? 'Editor' : 'Leitor'}`,
    },
  };

  const cfg = configByType[toast.type] || configByType.invitation;
  const { title, Icon, mainLine, metaLine } = cfg;

  return (
    <div
      className={`floating-invitation-toast animate-slide-up${showActions ? ' floating-invitation-toast--actions' : ''}`}
      role="alertdialog"
      aria-live="polite"
      aria-label={title}
    >
      <div className="floating-invitation-toast-header">
        <Icon size={14} />
        <span>{title}</span>
        <button
          type="button"
          className="floating-invitation-toast-close btn-icon"
          onClick={handleClose}
          aria-label="Fechar"
        >
          <X size={16} />
        </button>
      </div>

      <button
        type="button"
        className="floating-invitation-toast-body floating-invitation-toast-body--clickable"
        onClick={handleOpen}
        disabled={acting}
      >
        <div className="floating-notification-toast-row">
          <NotificationAvatar notification={toast} />
          <div className="floating-notification-toast-text">
            <div className="floating-invitation-toast-board">{mainLine}</div>
            <div className="floating-invitation-toast-meta">{metaLine}</div>
            {!showActions && (
              <span className="floating-invitation-toast-hint">Clique para abrir</span>
            )}
          </div>
        </div>
      </button>

      {showActions && (
        <div className="floating-invitation-toast-actions">
          <button
            type="button"
            className="floating-invitation-toast-btn floating-invitation-toast-btn--decline"
            onClick={handleDecline}
            disabled={acting}
          >
            <X size={14} />
            Recusar
          </button>
          <button
            type="button"
            className="floating-invitation-toast-btn floating-invitation-toast-btn--accept"
            onClick={handleAccept}
            disabled={acting}
          >
            <Check size={14} />
            Aceitar
          </button>
        </div>
      )}
    </div>
  );
}
