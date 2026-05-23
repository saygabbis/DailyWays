import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const collabEnv = path.resolve(__dirname, '../.env');
const rootEnvLocal = path.resolve(__dirname, '../../../.env.local');

dotenv.config({ path: collabEnv });

/** Reutiliza anon key do frontend para checagens RLS quando service_role estiver inválida. */
if (!process.env.SUPABASE_ANON_KEY && fs.existsSync(rootEnvLocal)) {
  const text = fs.readFileSync(rootEnvLocal, 'utf8');
  const match = text.match(/^VITE_SUPABASE_ANON_KEY\s*=\s*(.+)$/m);
  if (match) {
    process.env.SUPABASE_ANON_KEY = match[1].trim();
  }
  const urlMatch = text.match(/^VITE_SUPABASE_URL\s*=\s*(.+)$/m);
  if (urlMatch && !process.env.SUPABASE_URL) {
    process.env.SUPABASE_URL = urlMatch[1].trim();
  }
}
