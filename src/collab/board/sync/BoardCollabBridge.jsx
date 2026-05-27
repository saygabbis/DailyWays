import { useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { useCollab } from '../../core/CollabContext.jsx';
import { SERVER_EVENTS } from '@dailyways/collab-protocol';
import { notifyRemoteBoardAction } from '../ui/boardRemoteAnim.js';

/**
 * Applies remote board reducer actions from collab server into AppContext.
 */
export default function BoardCollabBridge() {
  const { dispatch } = useApp();
  const collab = useCollab();

  useEffect(() => {
    const socket = collab?.socket;
    if (!socket) return undefined;

    const onApplied = (payload) => {
      const op = payload?.op;
      if (op?.entity !== 'board' || op?.field !== 'action' || !op?.value) return;
      if (payload.userId === collab.userId) return;
      if (!op.value?.type) return;
      dispatch(op.value);
      notifyRemoteBoardAction(op.value);
    };

    socket.on(SERVER_EVENTS.APPLIED, onApplied);
    return () => {
      socket.off(SERVER_EVENTS.APPLIED, onApplied);
    };
  }, [collab?.socket, collab?.userId, dispatch]);

  return null;
}
