import { useState, useEffect } from 'react';
import {
  getCachedSpaceAssetUrl,
  isSupabaseSpaceAssetUrl,
  resolveSpaceAssetStoragePath,
  resolveSpaceAssetUrl,
} from '../services/spaceAssetService';

const REFRESH_MS = 50 * 60 * 1000;

/**
 * Resolve URL assinada para asset do whiteboard (storagePath ou url legada no nó).
 * Aceita nó completo ou { storagePath, url } (ex.: preenchimento de forma).
 */
export function useSpaceAssetUrl(source) {
  const storagePath = resolveSpaceAssetStoragePath(source);
  const legacyUrl = source?.url ?? source?.imageUrl ?? source?.data?.url ?? null;
  const cachedUrl = storagePath ? getCachedSpaceAssetUrl(storagePath) : null;

  const [url, setUrl] = useState(() => {
    if (cachedUrl) return cachedUrl;
    if (legacyUrl?.startsWith('http') && !isSupabaseSpaceAssetUrl(legacyUrl)) return legacyUrl;
    return null;
  });

  useEffect(() => {
    let cancelled = false;
    let refreshTimer;

    async function load() {
      if (storagePath) {
        const hit = getCachedSpaceAssetUrl(storagePath);
        if (hit) {
          if (!cancelled) setUrl(hit);
          return;
        }

        const resolved = await resolveSpaceAssetUrl(storagePath);
        if (!cancelled) setUrl(resolved);
        return;
      }

      if (legacyUrl?.startsWith('http') && !isSupabaseSpaceAssetUrl(legacyUrl)) {
        if (!cancelled) setUrl(legacyUrl);
        return;
      }

      if (!cancelled) setUrl(null);
    }

    load();
    refreshTimer = storagePath ? setInterval(load, REFRESH_MS) : undefined;

    return () => {
      cancelled = true;
      if (refreshTimer) clearInterval(refreshTimer);
    };
  }, [storagePath, legacyUrl, source?.id]);

  // Prefetch pode preencher o cache entre renders — ler cache síncrono.
  const liveCache = storagePath ? getCachedSpaceAssetUrl(storagePath) : null;
  if (liveCache) return liveCache;
  if (url) return url;
  if (legacyUrl?.startsWith('http') && !isSupabaseSpaceAssetUrl(legacyUrl)) return legacyUrl;
  return null;
}
