import { useEffect, useState, useRef } from 'react';
import { SERVER_EVENTS } from '@dailyways/collab-protocol';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import { useWhiteboardStore } from '../stores/whiteboardStore';
import { getCollabServerUrl, isCollabEnabled } from './collabConfig.js';
import {
  connectCollabSocket,
  disconnectCollabSocket,
  getCollabSocket,
} from './collabClient.js';
import { CollabProvider } from './CollabContext.jsx';
import { applyRemoteOp } from './applyOp.js';

export default function CollabProviderRoot({ children }) {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const userIdRef = useRef(user?.id);

  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);

  useEffect(() => {
    if (!isCollabEnabled() || !user?.id) {
      disconnectCollabSocket();
      setSocket(null);
      setConnected(false);
      return undefined;
    }

    let cancelled = false;
    let sock = null;
    let authSub = null;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token || cancelled) return;

      sock = connectCollabSocket(token);
      if (!sock || cancelled) return;

      setSocket(sock);

      const onConnect = () => {
        setConnected(true);
        console.info('[collab] connected', {
          url: getCollabServerUrl(),
          transport: sock.io?.engine?.transport?.name,
        });
      };
      const onDisconnect = () => setConnected(false);
      const onConnectError = (err) => {
        const xhr = err?.context?.xhr;
        const responseSnippet =
          typeof xhr?.responseText === 'string'
            ? xhr.responseText.slice(0, 200)
            : undefined;
        console.warn('[collab] connect error', err?.message || err, {
          url: getCollabServerUrl(),
          type: err?.type,
          description: err?.description,
          httpStatus: xhr?.status,
          responseSnippet,
        });
        setConnected(false);
      };

      const onApplied = (payload) => {
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
          userIdRef.current
        );
      };

      const onRejected = (payload) => {
        if (payload?.opId) {
          useWhiteboardStore.getState().rollbackPendingOp(payload.opId);
        }
      };

      sock.on('connect', onConnect);
      sock.on('disconnect', onDisconnect);
      sock.on('connect_error', onConnectError);
      sock.on(SERVER_EVENTS.APPLIED, onApplied);
      sock.on(SERVER_EVENTS.REJECTED, onRejected);

      if (sock.connected) setConnected(true);

      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (sock && session?.access_token) {
          sock.auth = { token: session.access_token };
        }
      });
      authSub = sub;
    })();

    return () => {
      cancelled = true;
      authSub?.subscription?.unsubscribe();
      if (sock) {
        sock.off('connect');
        sock.off('disconnect');
        sock.off('connect_error');
        sock.off(SERVER_EVENTS.APPLIED);
        sock.off(SERVER_EVENTS.REJECTED);
      }
      disconnectCollabSocket();
      setSocket(null);
      setConnected(false);
    };
  }, [user?.id]);

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
