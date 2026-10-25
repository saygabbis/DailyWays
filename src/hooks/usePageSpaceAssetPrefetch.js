import { useEffect } from 'react';
import {
  prefetchSpaceAssetPaths,
  resolveSpaceAssetStoragePath,
} from '../services/spaceAssetService';

/** Pré-resolve assets da página ativa para o cache (independente do culling do viewport). */
export function usePageSpaceAssetPrefetch(pageNodes) {
  useEffect(() => {
    const paths = [];
    for (const node of pageNodes ?? []) {
      if (node.type === 'image') {
        const p = resolveSpaceAssetStoragePath(node);
        if (p) paths.push(p);
        if (node.data?.thumbStoragePath) paths.push(node.data.thumbStoragePath);
      }
      const fill = node.style?.appearance?.fill;
      if (fill?.type === 'image') {
        const p = resolveSpaceAssetStoragePath({
          storagePath: fill.imageStoragePath,
          url: fill.imageUrl,
        });
        if (p) paths.push(p);
      }
    }
    if (paths.length) prefetchSpaceAssetPaths(paths);
  }, [pageNodes]);
}
