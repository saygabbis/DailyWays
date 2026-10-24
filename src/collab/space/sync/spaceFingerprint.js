

function countSpaceEntities({ nodes = [], connectors = [], comments = [] } = {}) {
  return (nodes?.length || 0) + (connectors?.length || 0) + (comments?.length || 0);
}

/** Snapshot do servidor nao pode apagar entidades que ainda existem localmente. */
export function isStaleSpaceSnapshot(local, server) {
  if (!local || !server) return false;
  return countSpaceEntities(server) < countSpaceEntities(local);
}
