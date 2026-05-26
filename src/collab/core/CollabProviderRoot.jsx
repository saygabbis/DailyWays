import { useEffect, useState, useRef } from 'react';
import { SERVER_EVENTS } from '@dailyways/collab-protocol';
import { flushPresenceSyncNow } from '../board/presence/queuePresenceSync.js';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { useWhiteboardStore } from '../../stores/whiteboardStore';
import { getCollabServerUrl, isCollabEnabled } from './collabConfig.js';
import {
  connectCollabSocket,
  disconnectCollabSocket,
  getCollabSocket,
} from './collabClient.js';
import { getGlobalJoinedBoardId } from '../board/sync/boardCollabSession.js';
import { CollabProvider } from './CollabContext.jsx';
import { applyRemoteOp } from '../whiteboard/applyOp.js';
import { useToast } from '../../context/ToastContext.jsx';
import { toastCollabError } from './collabToast.js';
import { applyVictimPuppetCursor, useBoardDevPrankStore } from '../board/dev/boardDevPrank.js';

function bindCollabSocket(sock, handlers) {
  sock.on('connect', handlers.onConnect);
  sock.on('disconnect', handlers.onDisconnect);
  sock.on('connect_error', handlers.onConnectError);
  sock.on(SERVER_EVENTS.APPLIED, handlers.onApplied);
  if (handlers.onRejected) sock.on(SERVER_EVENTS.REJECTED, handlers.onRejected);
  sock.on(SERVER_EVENTS.PRESENCE_SYNC, handlers.onPresenceSync);
  if (handlers.onDevPrankFrozen) sock.on('dev:prank-frozen', handlers.onDevPrankFrozen);
  if (handlers.onDevPrankHold) sock.on('dev:prank-hold', handlers.onDevPrankHold);
  if (handlers.onDevPrankCursor) sock.on('dev:prank-cursor', handlers.onDevPrankCursor);
}

function unbindCollabSocket(sock) {
  if (!sock) return;
  sock.off('connect');
  sock.off('disconnect');
  sock.off('connect_error');
  sock.off(SERVER_EVENTS.APPLIED);
  sock.off(SERVER_EVENTS.REJECTED);
  sock.off(SERVER_EVENTS.PRESENCE_SYNC);
  sock.off('dev:prank-frozen');
  sock.off('dev:prank-hold');
  sock.off('dev:prank-cursor');
}

export default function CollabProviderRoot({ children }) {
  const { user, loading: authLoading } = useAuth();
  const { addToast } = useToast();
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const userIdRef = useRef(user?.id);
  const authLoadingRef = useRef(authLoading);

  useEffect(() => {
    userIdRef.current = user?.id;
    authLoadingRef.current = authLoading;
  }, [user?.id, authLoading]);

  useEffect(() => {
    if (!isCollabEnabled() || !user?.id || authLoadingRef.current) {
      disconnectCollabSocket();
      setSocket(null);
      setConnected(false);
      return undefined;
    }

    let cancelled = false;
    let sock = null;
    let authSub = null;
    let consecutiveConnectErrors = 0;

    const handlers = {
      onConnect: () => {
        consecutiveConnectErrors = 0;
        setConnected(true);
        console.info('[collab] connected', {
          url: getCollabServerUrl(),
          origin: typeof window !== 'undefined' ? window.location.origin : undefined,
          transport: sock?.io?.engine?.transport?.name,
        });
      },
      onDisconnect: () => {
        setConnected(false);
      },
      onConnectError: (err) => {
        consecutiveConnectErrors += 1;
        const xhr = err?.context?.xhr;
        const responseSnippet =
          typeof xhr?.responseText === 'string'
            ? xhr.responseText.slice(0, 200)
            : undefined;
        if (consecutiveConnectErrors <= 3) {
          console.warn('[collab] connect error', err?.message || err, {
          url: getCollabServerUrl(),
          origin: typeof window !== 'undefined' ? window.location.origin : undefined,
          type: err?.type,
          description: err?.description,
          httpStatus: xhr?.status,
          responseSnippet,
          });
        }
        setConnected(false);
        const msg = (err?.message || '').toLowerCase();
        if (
          consecutiveConnectErrors >= 6
          && sock?.io
          && (msg.includes('xhr poll error') || msg.includes('websocket error'))
        ) {
          sock.io.opts.reconnection = false;
          console.warn('[collab] servidor indisponível — reconexão pausada. Inicie o collab-server ou recarregue a página.');
        }
        if (msg.includes('unauthorized') || msg.includes('auth')) {
          if (sock?.io) {
            sock.io.opts.reconnection = false;
          }
          sock?.disconnect();
          toastCollabError(
            addToast,
            'Sessão expirada. Recarregue a página ou faça login novamente.',
          );
        }
      },
      onApplied: (payload) => {
        const fromUserId = payload?.userId;
        const op = payload?.op;
        if (!op) return;
        if (op.entity === 'board') return;
        if (fromUserId === userIdRef.current) {
          const store = useWhiteboardStore.getState();
          if (store.pendingOps[op.opId]) {
            store.clearPendingOp(op.opId);
          }
          if (payload.revision != null) {
            store.setRevision(Math.max(store.revision, payload.revision));
          }
          return;
        }
        applyRemoteOp(
          { op, revision: payload.revision },
          fromUserId,
          userIdRef.current,
        );
      },
      onPresenceSync: (payload) => {
        const peers = payload?.peers;
        if (!peers) return;
        const joined = getGlobalJoinedBoardId();
        const syncBoardId = payload?.boardId;
        if (syncBoardId && joined && joined !== syncBoardId) return;
        flushPresenceSyncNow(peers);
      },
      onDevPrankFrozen: (payload) => {
        if (!payload?.frozen) return;
        useBoardDevPrankStore.getState().setHeld(false);
        useBoardDevPrankStore.getState().clearVictimPuppetCursor();
        useBoardDevPrankStore.getState().setFrozen(true);
        disconnectCollabSocket();
        addToast({
          type: 'warning',
          message: payload?.message || 'Você foi congelado (dev). Recarregue a página (F5).',
          duration: 12000,
        });
      },
      onDevPrankHold: (payload) => {
        const held = Boolean(payload?.held);
        useBoardDevPrankStore.getState().setHeld(held);
        if (!held) {
          useBoardDevPrankStore.getState().clearVictimPuppetCursor();
        }
      },
      onDevPrankCursor: (payload) => {
        const { boardId, x, y } = payload || {};
        if (!boardId || typeof x !== 'number' || typeof y !== 'number') return;
        if (!useBoardDevPrankStore.getState().held) return;
        applyVictimPuppetCursor(boardId, x, y);
      },
    };

    const reconnectWithToken = (token) => {
      if (cancelled || !token) return;
      unbindCollabSocket(sock);
      disconnectCollabSocket();
      sock = connectCollabSocket(token);
      if (!sock || cancelled) return;
      bindCollabSocket(sock, handlers);
      setSocket(sock);
      if (sock.connected) setConnected(true);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('collab-socket-reconnected'));
      }
    };

    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token || cancelled) return;

      sock = connectCollabSocket(token);
      if (!sock || cancelled) return;

      bindCollabSocket(sock, handlers);
      setSocket(sock);
      if (sock.connected) setConnected(true);

      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        if (cancelled || !session?.access_token) return;
        if (event === 'TOKEN_REFRESHED') {
          reconnectWithToken(session.access_token);
          return;
        }
        if (sock) {
          sock.auth = { token: session.access_token };
        }
      });
      authSub = sub;
    })();

    return () => {
      cancelled = true;
      authSub?.subscription?.unsubscribe();
      unbindCollabSocket(sock);
      disconnectCollabSocket();
      setSocket(null);
      setConnected(false);
    };
  }, [user?.id, addToast]);

  const value = {
    socket: socket || getCollabSocket(),
    connected,
    userId: user?.id,
  };

  return (
    <CollabProvider value={value}>
      {children}
    </CollabProvider>
  );
}
