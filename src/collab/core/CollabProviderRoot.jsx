import { useEffect, useState, useRef } from 'react';
import { CLIENT_EVENTS, SERVER_EVENTS } from '@dailyways/collab-protocol';
import { useAuth } from '../../context/useAuth';
import { supabase } from '../../services/supabaseClient';
import { useWhiteboardStore } from '../../stores/whiteboardStore';
import { getCollabServerUrl, isCollabEnabled } from './collabConfig.js';
import {
  connectCollabSocket,
  disconnectCollabSocket,
  getCollabSocket,
  isOwnOp,
} from './collabClient.js';
import { CollabProvider } from './CollabContext.jsx';
import { applyRemoteOp } from '../space/ops/applyOp.js';
import { useToast } from '../../context/useToast';
import { toastCollabError } from './collabToast.js';
import { applyVictimPuppetCursor, useBoardDevPrankStore } from '../board/dev/boardDevPrank.js';
import {
  bindSocketHandlers,
  unbindSocketHandlers,
} from '../shared/session/socketBindings.js';

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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- ciclo de vida do socket de collab: zera o estado ao desconectar
      setSocket(null);
      setConnected(false);
      return undefined;
    }

    let cancelled = false;
    let sock = null;
    let bindings = [];
    let authSub = null;
    let consecutiveConnectErrors = 0;
    let authFailures = 0;
    let authRetryTimer = null;

    const handlers = {
      onConnect: () => {
        consecutiveConnectErrors = 0;
        authFailures = 0;
        setConnected(true);
        console.info('[collab] connected', {
          url: getCollabServerUrl(),
          origin: typeof window !== 'undefined' ? window.location.origin : undefined,
          transport: sock?.io?.engine?.transport?.name,
        });
      },
      onDisconnect: (reason) => {
        setConnected(false);
        // O servidor derrubou de propósito (ex.: token trocado): o socket.io não reconecta sozinho.
        if (reason === 'io server disconnect' && !cancelled) {
          setTimeout(async () => {
            if (cancelled || !sock || sock.connected) return;
            const { data } = await supabase.auth.getSession();
            if (cancelled) return;
            if (data?.session?.access_token) sock.auth = { token: data.session.access_token };
            sock.connect();
          }, 300);
        }
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
        // Erro de rede (servidor reiniciando no deploy, Wi-Fi caiu): o socket.io continua tentando
        // sozinho, para sempre. Antes desligava depois de 6 erros e a aba ficava presa até o F5.
        if (msg.includes('unauthorized') || msg.includes('auth')) {
          // Recusa do middleware não reconecta sozinha: pega um token novo (o Supabase renova se
          // venceu) e tenta de novo, com espera crescente. Só avisa se continuar recusando.
          authFailures += 1;
          if (authFailures === 4) {
            toastCollabError(
              addToast,
              'Sessão expirada. Recarregue a página ou faça login novamente.',
            );
          }
          clearTimeout(authRetryTimer);
          const wait = Math.min(1000 * 2 ** Math.min(authFailures - 1, 4), 15000);
          authRetryTimer = setTimeout(async () => {
            if (cancelled || !sock || sock.connected) return;
            const { data } = await supabase.auth.getSession();
            const fresh = data?.session?.access_token;
            if (cancelled || !fresh) return;
            sock.auth = { token: fresh };
            sock.connect();
          }, wait);
        }
      },
      onApplied: (payload) => {
        const fromUserId = payload?.userId;
        const op = payload?.op;
        if (!op) return;
        if (op.entity === 'board') return;
        if (isOwnOp(payload.opId ?? op.opId)) {
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
      unbindSocketHandlers(sock, bindings);
      disconnectCollabSocket();
      sock = connectCollabSocket(token);
      if (!sock || cancelled) return;
      bindings = bindSocketHandlers(sock, [
        ['connect', handlers.onConnect],
        ['disconnect', handlers.onDisconnect],
        ['connect_error', handlers.onConnectError],
        [SERVER_EVENTS.APPLIED, handlers.onApplied],
        [SERVER_EVENTS.REJECTED, handlers.onRejected],
        ['dev:prank-frozen', handlers.onDevPrankFrozen],
        ['dev:prank-hold', handlers.onDevPrankHold],
        ['dev:prank-cursor', handlers.onDevPrankCursor],
      ]);
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

      bindings = bindSocketHandlers(sock, [
        ['connect', handlers.onConnect],
        ['disconnect', handlers.onDisconnect],
        ['connect_error', handlers.onConnectError],
        [SERVER_EVENTS.APPLIED, handlers.onApplied],
        [SERVER_EVENTS.REJECTED, handlers.onRejected],
        ['dev:prank-frozen', handlers.onDevPrankFrozen],
        ['dev:prank-hold', handlers.onDevPrankHold],
        ['dev:prank-cursor', handlers.onDevPrankCursor],
      ]);
      setSocket(sock);
      if (sock.connected) setConnected(true);

      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        if (cancelled || !session?.access_token) return;
        if (sock) {
          sock.auth = { token: session.access_token };
        }
        if (event !== 'TOKEN_REFRESHED') return;
        // Troca o token no servidor sem derrubar o socket (as salas e a fila de ops continuam).
        // Só reconecta se o servidor não aceitar (servidor antigo, sem o evento).
        if (!sock?.connected) return;
        const token = session.access_token;
        let answered = false;
        const fallback = setTimeout(() => {
          if (!answered) reconnectWithToken(token);
        }, 5000);
        sock.emit(CLIENT_EVENTS.AUTH_REFRESH, { token }, (res) => {
          answered = true;
          clearTimeout(fallback);
          if (!res?.ok) reconnectWithToken(token);
        });
      });
      authSub = sub;
    })();

    return () => {
      cancelled = true;
      clearTimeout(authRetryTimer);
      authSub?.subscription?.unsubscribe();
      unbindSocketHandlers(sock, bindings);
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
