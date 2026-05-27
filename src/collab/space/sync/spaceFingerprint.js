export function spaceStructuralFingerprint({ nodes = [], connectors = [], comments = [] } = {}) {
  const nodePart = (nodes || [])
    .map((n) => `${n.id}:${n.x ?? 0},${n.y ?? 0},${n.width ?? 0},${n.height ?? 0}`)
    .sort()
    .join('|');
  const connPart = (connectors || []).map((c) => c.id).sort().join(',');
  const commentPart = (comments || []).map((c) => c.id).sort().join(',');
  return `${nodePart};${connPart};${commentPart}`;
}

export function countSpaceEntities({ nodes = [], connectors = [], comments = [] } = {}) {
  return (nodes?.length || 0) + (connectors?.length || 0) + (comments?.length || 0);
}

/** Snapshot do servidor nao pode apagar entidades que ainda existem localmente. */
export function isStaleSpaceSnapshot(local, server) {
  if (!local || !server) return false;
  return countSpaceEntities(server) < countSpaceEntities(local);
}
