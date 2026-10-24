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

/**
 * Nome, foto e cor da presença vêm SEMPRE do perfil no banco: antes o servidor aceitava o que o
 * cliente mandasse (dava para aparecer no cursor como outra pessoa, com a foto dela) e, sem nome,
 * mostrava aos outros o começo do e-mail.
 */
export async function enrichPresenceFromProfile(userId, payload) {
  let profile = cacheGet(userId);
  if (!profile && supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('name, photo_url, presence_color, presence_color_auto')
      .eq('id', userId)
      .maybeSingle();
    profile = data || null;
    if (profile) cacheSet(userId, profile);
  }

  const out = { ...payload };
  if (profile) {
    out.name = profile.name || 'Usuário';
    out.photoUrl = profile.photo_url || null;
    if (profile.presence_color && profile.presence_color_auto === false) out.color = profile.presence_color;
  } else if (!out.name) {
    out.name = 'Usuário';
  }
  if (typeof out.photoUrl === 'string' && !/^https:\/\//i.test(out.photoUrl)) out.photoUrl = null;
  out.avatarInitial = String(out.name).trim().charAt(0).toUpperCase() || '?';
  return out;
}
