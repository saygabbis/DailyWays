import { createClient } from '@supabase/supabase-js';
import { devLog } from '../devLog.js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function isServiceKeyLikelyValid() {
  if (!serviceKey) return false;
  if (serviceKey.length < 120) return false;
  if (serviceKey.endsWith('>')) return false;
  return true;
}

if (!url || !serviceKey) {
  console.warn('[collab-server] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for persistence');
} else if (!isServiceKeyLikelyValid()) {
  console.error(
    `[collab-server] SUPABASE_SERVICE_ROLE_KEY parece truncada (${serviceKey.length} chars). ` +
      'Cole a chave service_role completa no .env — sem isso flush/load do board falham.',
  );
}

/** Service role — apenas persistência/flush e tarefas administrativas do servidor. */
export const supabaseAdmin =
  url && serviceKey && isServiceKeyLikelyValid()
    ? createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

export function createUserScopedClient(accessToken) {
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey || !accessToken) return null;
  return createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Cliente com RLS do usuário (auth, canAccess*, load de dados). Nunca usa service_role. */
export function getUserDbClient(accessToken) {
  return createUserScopedClient(accessToken);
}

devLog('supabase.init', {
  hasUrl: Boolean(url),
  hasServiceKey: Boolean(serviceKey),
  serviceKeyLen: serviceKey?.length ?? 0,
  serviceKeyLikelyValid: isServiceKeyLikelyValid(),
  hasSupabaseAdmin: Boolean(supabaseAdmin),
  hasAnonKey: Boolean(process.env.SUPABASE_ANON_KEY),
});
