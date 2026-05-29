import { supabase } from './supabaseClient';

export const SPACE_ASSETS_BUCKET = 'space-assets';
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/** Extrai storage path de URL pública legada do Supabase. */
export function extractStoragePathFromLegacyUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const marker = `/storage/v1/object/public/${SPACE_ASSETS_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx < 0) return null;
  return decodeURIComponent(url.slice(idx + marker.length).split('?')[0]);
}

/** Path relativo ou URL legada → path no bucket. */
export function resolveSpaceAssetStoragePath(nodeOrData) {
  if (!nodeOrData) return null;
  const storagePath = nodeOrData.storagePath ?? nodeOrData.data?.storagePath;
  if (storagePath) return storagePath;
  const url = nodeOrData.url ?? nodeOrData.data?.url;
  if (!url) return null;
  if (!url.startsWith('http')) return url;
  return extractStoragePathFromLegacyUrl(url);
}

export async function resolveSpaceAssetUrl(storagePathOrLegacyUrl) {
  if (!storagePathOrLegacyUrl) return null;
  let path = storagePathOrLegacyUrl;
  if (path.startsWith('http')) {
    path = extractStoragePathFromLegacyUrl(path);
    if (!path) return storagePathOrLegacyUrl;
  }
  const { data, error } = await supabase.storage
    .from(SPACE_ASSETS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) return null;
  return data?.signedUrl ?? null;
}
