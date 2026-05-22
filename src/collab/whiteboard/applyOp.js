import { fieldToPatch } from '@dailyways/collab-protocol';
import { useWhiteboardStore } from '../../stores/whiteboardStore';

export function applyRemoteOp(op, fromUserId, myUserId) {
  const store = useWhiteboardStore.getState();
  const isOwn = fromUserId && myUserId && fromUserId === myUserId;

  if (op.revision != null && op.revision <= store.revision && !isOwn) {
    return;
  }

  const { type, entity, id, field, value } = op.op || op;

  if (type === 'create') {
    if (entity === 'node') store.addNodeRemote(value);
    else if (entity === 'connector') store.addConnectorRemote(value);
    else if (entity === 'comment') store.addCommentRemote(value);
  } else if (type === 'delete') {
    if (entity === 'node') store.removeNodeRemote(id);
    else if (entity === 'connector') store.removeConnectorRemote(id);
    else if (entity === 'comment') store.removeCommentRemote(id);
  } else if (type === 'update') {
    const patch = fieldToPatch(field, value);
    if (entity === 'node') store.applyRemotePatch(id, patch);
    else if (entity === 'connector') store.patchConnectorRemote(id, patch);
    else if (entity === 'comment') store.patchCommentRemote(id, patch);
  }

  if (op.revision != null) {
    store.setRevision(Math.max(store.revision, op.revision));
  }
}
