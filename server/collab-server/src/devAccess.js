import { supabaseAdmin } from './supabase.js';

export const PRIMARY_DEV_EMAIL = 'gaffonsoxx@gmail.com';
export const PRIMARY_DEV_USERNAME = 'gabbis';

const DEFAULT_CONFIG = { prankEnabled: true, additionalDevs: [] };
const CACHE_MS = 30_000;

let cachedConfig = null;
let cacheAt = 0;
const usernameCache = new Map();

function normEmail(email) {
  return (email || '').toLowerCase();
}

function normUsername(username) {
  return (username || '').toLowerCase().replace(/^@/, '');
}

function parseConfig(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CONFIG };
  return {
    prankEnabled: raw.prankEnabled !== false,
    additionalDevs: Array.isArray(raw.additionalDevs) ? raw.additionalDevs : [],
  };
}

export async function getDevToolConfig() {
  if (cachedConfig && Date.now() - cacheAt < CACHE_MS) {
    return cachedConfig;
  }
  if (!supabaseAdmin) {
    cachedConfig = { ...DEFAULT_CONFIG };
    cacheAt = Date.now();
    return cachedConfig;
  }
  try {
    const { data } = await supabaseAdmin
      .from('dev_tool_config')
      .select('config')
      .eq('id', 'global')
      .maybeSingle();
    cachedConfig = parseConfig(data?.config);
  } catch {
    cachedConfig = { ...DEFAULT_CONFIG };
  }
  cacheAt = Date.now();
  return cachedConfig;
}

export function invalidateDevToolConfigCache() {
  cachedConfig = null;
  cacheAt = 0;
}

async function getUsernameForUser(userId) {
  if (!userId || !supabaseAdmin) return null;
  const hit = usernameCache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.username;
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .maybeSingle();
  const username = data?.username || null;
  usernameCache.set(userId, { at: Date.now(), username });
  return username;
}

export function accountMatchesDev(email, username, config) {
  const e = normEmail(email);
  const u = normUsername(username);
  if (e === PRIMARY_DEV_EMAIL || u === PRIMARY_DEV_USERNAME) return true;
  for (const entry of config?.additionalDevs || []) {
    if (!entry?.value) continue;
    if (entry.kind === 'email' && e === entry.value) return true;
    if (entry.kind === 'username' && u === entry.value) return true;
  }
  return false;
}

/** Quem pode emitir dev:prank (atacante). */
export async function isDevPrankAttacker(socket) {
  const config = await getDevToolConfig();
  if (!config.prankEnabled) return false;

  const devOn =
    process.env.COLLAB_DEV_PRANK === '1'
    || process.env.NODE_ENV !== 'production';
  if (!devOn) return false;

  const email = socket?.data?.userEmail;
  const username = await getUsernameForUser(socket?.data?.userId);
  return accountMatchesDev(email, username, config);
}
