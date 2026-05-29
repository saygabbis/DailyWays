import { useState, useEffect } from 'react';
import { resolveSpaceAssetStoragePath, resolveSpaceAssetUrl } from '../services/spaceAssetService';

/**
 * Resolve URL assinada para asset do whiteboard (storagePath ou url legada no nó).
 */
export function useSpaceAssetUrl(node) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const path = resolveSpaceAssetStoragePath(node);
    const legacyHttp = node?.data?.url?.startsWith('http') ? node.data.url : null;

    if (!path && !legacyHttp) {
      setUrl(null);
      return undefined;
    }

    (async () => {
      const resolved = path ? await resolveSpaceAssetUrl(path) : null;
      if (cancelled) return;
      setUrl(resolved || legacyHttp);
    })();

    return () => {
      cancelled = true;
    };
  }, [node?.data?.storagePath, node?.data?.url]);

  return url;
}
