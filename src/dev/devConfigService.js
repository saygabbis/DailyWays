import { supabase } from '../services/supabaseClient.js';
import { DEFAULT_DEV_CONFIG } from './devAccess.js';

const ROW_ID = 'global';

function parseConfig(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_DEV_CONFIG };
  const additionalDevs = Array.isArray(raw.additionalDevs)
    ? raw.additionalDevs.filter((e) => e?.kind === 'userId' && e?.value)
    : [];
  return {
    prankEnabled: raw.prankEnabled !== false,
    additionalDevs,
  };
}

async function resolveDevEntry(entry) {
  if (!entry?.value) return null;
  if (entry.kind === 'userId') {
    return {
      kind: 'userId',
      value: entry.value,
      label: entry.label || entry.value.slice(0, 8),
    };
  }
  const { data, error } = await supabase.rpc('resolve_account_id_for_dev', {
    p_identifier: entry.value,
  });
  if (error || !data) return null;
  return {
    kind: 'userId',
    value: data,
    label: entry.label || entry.value,
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
  const raw = parseConfig(config);
  const resolved = [];
  for (const entry of raw.additionalDevs || []) {
    const r = await resolveDevEntry(entry);
    if (r) resolved.push(r);
  }
  const payload = { prankEnabled: raw.prankEnabled, additionalDevs: resolved };

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
