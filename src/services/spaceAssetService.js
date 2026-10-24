import { supabase } from './supabaseClient';

export const SPACE_ASSETS_BUCKET = 'space-assets';
const SIGNED_URL_TTL_SECONDS = 60 * 60;
/** Renova um pouco antes do TTL para evitar URL expirada no canvas. */
const CACHE_REFRESH_MS = (SIGNED_URL_TTL_SECONDS - 5 * 60) * 1000;

const signedUrlCache = new Map();
const inflightResolves = new Map();

const STORAGE_OBJECT_MARKERS = [
  `/storage/v1/object/public/${SPACE_ASSETS_BUCKET}/`,
  `/storage/v1/object/sign/${SPACE_ASSETS_BUCKET}/`,
  `/storage/v1/object/authenticated/${SPACE_ASSETS_BUCKET}/`,
];

/** Extrai storage path de URL pública, assinada ou autenticada do Supabase. */
function extractStoragePathFromLegacyUrl(url) {
  if (!url || typeof url !== 'string') return null;
  for (const marker of STORAGE_OBJECT_MARKERS) {
    const idx = url.indexOf(marker);
    if (idx >= 0) {
      return decodeURIComponent(url.slice(idx + marker.length).split('?')[0]);
    }
  }
  return null;
}

export function isSupabaseSpaceAssetUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return STORAGE_OBJECT_MARKERS.some((m) => url.includes(m));
}

/** Path relativo ou URL legada → path no bucket. */
export function resolveSpaceAssetStoragePath(nodeOrData) {
  if (!nodeOrData) return null;
  const storagePath =
    nodeOrData.storagePath
    ?? nodeOrData.imageStoragePath
    ?? nodeOrData.data?.storagePath;
  if (storagePath) return storagePath;
  const url = nodeOrData.url ?? nodeOrData.imageUrl ?? nodeOrData.data?.url;
  if (!url) return null;
  if (!url.startsWith('http')) return url;
  return extractStoragePathFromLegacyUrl(url);
}

/** Retorna URL assinada em cache (síncrono), se ainda válida. */
export function getCachedSpaceAssetUrl(storagePath) {
  if (!storagePath) return null;
  const entry = signedUrlCache.get(storagePath);
  if (!entry || entry.expiresAt <= Date.now()) return null;
  return entry.url;
}

export async function resolveSpaceAssetUrl(storagePathOrLegacyUrl, { retries = 2 } = {}) {
  if (!storagePathOrLegacyUrl) return null;
  let path = storagePathOrLegacyUrl;
  if (path.startsWith('http')) {
    path = extractStoragePathFromLegacyUrl(path);
    if (!path) return storagePathOrLegacyUrl;
  }

  const cached = getCachedSpaceAssetUrl(path);
  if (cached) return cached;

  if (inflightResolves.has(path)) {
    return inflightResolves.get(path);
  }

  const promise = (async () => {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const { data, error } = await supabase.storage
        .from(SPACE_ASSETS_BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      const url = !error ? data?.signedUrl ?? null : null;
      if (url) {
        signedUrlCache.set(path, { url, expiresAt: Date.now() + CACHE_REFRESH_MS });
        return url;
      }
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 120 * (attempt + 1)));
      }
    }
    return null;
  })().finally(() => {
    inflightResolves.delete(path);
  });

  inflightResolves.set(path, promise);
  return promise;
}

/** Pré-carrega URLs assinadas (cache + dedup) sem depender de montar ImageNode. */
export function prefetchSpaceAssetPaths(paths) {
  const unique = [...new Set((paths ?? []).filter(Boolean))];
  for (const path of unique) {
    if (!getCachedSpaceAssetUrl(path)) {
      void resolveSpaceAssetUrl(path);
    }
  }
}
