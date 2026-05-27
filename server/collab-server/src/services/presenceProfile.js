import { supabaseAdmin } from '../db/supabase.js';

const cache = new Map();
const CACHE_MS = 60_000;

function cacheGet(userId) {
  const hit = cache.get(userId);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_MS) {
    cache.delete(userId);
    return null;
  }
  return hit.data;
}

function cacheSet(userId, data) {
  cache.set(userId, { at: Date.now(), data });
}

/** Fill name/photo/color from profiles when the client sent a placeholder or omitted meta. */
export async function enrichPresenceFromProfile(userId, payload, userEmail) {
  const needsName = !payload.name || payload.name === 'Usuário';
  const needsPhoto = payload.photoUrl == null;
  const needsColor = !payload.color;

  if (!needsName && !needsPhoto && !needsColor) return payload;
  if (!supabaseAdmin) return payload;

  let profile = cacheGet(userId);
  if (!profile) {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('name, photo_url, presence_color, presence_color_auto')
      .eq('id', userId)
      .maybeSingle();
    profile = data || null;
    if (profile) cacheSet(userId, profile);
  }

  const out = { ...payload };
  if (needsName) {
    out.name =
      profile?.name
      || (userEmail ? userEmail.split('@')[0] : null)
      || out.name
      || 'Usuário';
  }
  if (needsPhoto && profile?.photo_url) out.photoUrl = profile.photo_url;
  if (needsColor && profile?.presence_color) out.color = profile.presence_color;
  if (!out.avatarInitial && out.name) {
    out.avatarInitial = String(out.name).trim().charAt(0).toUpperCase() || '?';
  }
  return out;
}
