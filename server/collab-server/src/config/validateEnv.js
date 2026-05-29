import { supabaseAdmin, isServiceKeyLikelyValid } from '../db/supabase.js';

const DASHBOARD_API =
  'https://supabase.com/dashboard/project/vdehmvwnpoabcobixgpo/settings/api';

export function validateCollabEnv() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const url = process.env.SUPABASE_URL || '';
  const anon = process.env.SUPABASE_ANON_KEY || '';
  const issues = [];

  if (!url) issues.push('SUPABASE_URL ausente em server/collab-server/.env');
  if (!anon) {
    issues.push(
      'SUPABASE_ANON_KEY ausente (copie VITE_SUPABASE_ANON_KEY do .env.local ou defina no .env do collab)',
    );
  }
  if (!isServiceKeyLikelyValid()) {
    issues.push(
      `SUPABASE_SERVICE_ROLE_KEY inválida ou truncada (${key.length} caracteres${key.endsWith('>') ? ', termina com ">"' : ''}). ` +
        `Cole a chave service_role completa (~200+ caracteres) em server/collab-server/.env — Dashboard: ${DASHBOARD_API}`,
    );
  }

  if (process.env.NODE_ENV === 'production' && process.env.COLLAB_DEV_PRANK === '1') {
    issues.push('COLLAB_DEV_PRANK=1 em produção — desative salvo necessidade explícita');
  }

  if (issues.length === 0) return;

  const banner = [
    '',
    '══════════════════════════════════════════════════════════════',
    '[collab-server] Configuração inválida — tempo real e persistência falham:',
    ...issues.map((line) => `  • ${line}`),
    '══════════════════════════════════════════════════════════════',
    '',
  ].join('\n');

  console.error(banner);
}
