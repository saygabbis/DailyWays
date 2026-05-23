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

function bindCollabSocket(sock, handlers) {
  sock.on('connect', handlers.onConnect);
  sock.on('disconnect', handlers.onDisconnect);
  sock.on('connect_error', handlers.onConnectError);
  sock.on(SERVER_EVENTS.APPLIED, handlers.onApplied);
  if (handlers.onRejected) sock.on(SERVER_EVENTS.REJECTED, handlers.onRejected);
  sock.on(SERVER_EVENTS.PRESENCE_SYNC, handlers.onPresenceSync);
}

function unbindCollabSocket(sock) {
  if (!sock) return;
  sock.off('connect');
  sock.off('disconnect');
  sock.off('connect_error');
  sock.off(SERVER_EVENTS.APPLIED);
  sock.off(SERVER_EVENTS.REJECTED);
  sock.off(SERVER_EVENTS.PRESENCE_SYNC);
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

    const handlers = {
      onConnect: () => {
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
        const xhr = err?.context?.xhr;
        const responseSnippet =
          typeof xhr?.responseText === 'string'
            ? xhr.responseText.slice(0, 200)
            : undefined;
        // #region agent log
        fetch('http://127.0.0.1:7696/ingest/01fa34d4-9615-473f-b720-e19b7f0835ca',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'64ad20'},body:JSON.stringify({sessionId:'64ad20',hypothesisId:'H4-H5',location:'CollabProviderRoot.jsx:onConnectError',message:'collab connect_error',data:{errMsg:err?.message??null,httpStatus:xhr?.status??null,responseSnippet,type:err?.type??null,url:getCollabServerUrl()},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        console.warn('[collab] connect error', err?.message || err, {
          url: getCollabServerUrl(),
          origin: typeof window !== 'undefined' ? window.location.origin : undefined,
          type: err?.type,
          description: err?.description,
          httpStatus: xhr?.status,
          responseSnippet,
        });
        setConnected(false);
        const msg = (err?.message || '').toLowerCase();
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
      // #region agent log
      fetch('http://127.0.0.1:7696/ingest/01fa34d4-9615-473f-b720-e19b7f0835ca',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'64ad20'},body:JSON.stringify({sessionId:'64ad20',hypothesisId:'H2-H5',location:'CollabProviderRoot.jsx:getSession',message:'collab connect prep',data:{hasToken:!!token,tokenLen:token?.length??0,userIdPrefix:user?.id?.slice(0,8)??null,url:getCollabServerUrl(),cancelled},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
