import { supabase } from '../services/supabaseClient.js';
import { DEFAULT_DEV_CONFIG } from './devAccess.js';

const ROW_ID = 'global';

function parseConfig(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_DEV_CONFIG };
  return {
    prankEnabled: raw.prankEnabled !== false,
    additionalDevs: Array.isArray(raw.additionalDevs) ? raw.additionalDevs : [],
  };
}

export async function fetchDevToolConfig() {
  const { data, error } = await supabase
    .from('dev_tool_config')
    .select('config')
    .eq('id', ROW_ID)
    .maybeSingle();

  if (error) {
    console.warn('[devConfig] fetch failed', error.message);
    return { ...DEFAULT_DEV_CONFIG };
  }
  return parseConfig(data?.config);
}

export async function saveDevToolConfig(config) {
  const payload = parseConfig(config);
  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id ?? null;

  const { error } = await supabase
    .from('dev_tool_config')
    .upsert({
      id: ROW_ID,
      config: payload,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    });

  if (error) throw error;
  return payload;
}
