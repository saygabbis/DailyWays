import { supabaseAdmin } from '../db/supabase.js';

export const PRIMARY_DEV_EMAIL = 'gaffonsoxx@gmail.com';

const DEFAULT_CONFIG = { prankEnabled: true, additionalDevs: [] };
const CACHE_MS = 30_000;

let cachedConfig = null;
let cacheAt = 0;
let cachedDevUserIds = null;

function normEmail(email) {
  return (email || '').toLowerCase();
}

function parseConfig(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CONFIG };
  const additionalDevs = Array.isArray(raw.additionalDevs)
    ? raw.additionalDevs.filter((e) => e?.kind === 'email' || e?.kind === 'userId')
    : [];
  return {
    prankEnabled: raw.prankEnabled !== false,
    additionalDevs,
  };
}

function getEnvDevUserIds() {
  if (cachedDevUserIds) return cachedDevUserIds;
  const raw = process.env.COLLAB_DEV_USER_IDS || '';
  cachedDevUserIds = new Set(
    raw.split(',').map((s) => s.trim()).filter(Boolean),
  );
  return cachedDevUserIds;
}

export function isDevPrankHandlerEnabled() {
  if (process.env.NODE_ENV === 'production') {
    return process.env.COLLAB_DEV_PRANK === '1';
  }
  return process.env.COLLAB_DEV_PRANK !== '0';
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

export function accountMatchesDev(userId, email, config) {
  if (!userId) return false;
  const envIds = getEnvDevUserIds();
  if (envIds.has(userId)) return true;

  const e = normEmail(email);
  if (e === PRIMARY_DEV_EMAIL) return true;

  for (const entry of config?.additionalDevs || []) {
    if (!entry?.value) continue;
    if (entry.kind === 'email' && e === normEmail(entry.value)) return true;
    if (entry.kind === 'userId' && userId === entry.value) return true;
  }
  return false;
}

/** Quem pode emitir dev:prank (atacante). */
export async function isDevPrankAttacker(socket) {
  if (!isDevPrankHandlerEnabled()) return false;

  const config = await getDevToolConfig();
  if (!config.prankEnabled) return false;

  const userId = socket?.data?.userId;
  const email = socket?.data?.userEmail;
  return accountMatchesDev(userId, email, config);
}
