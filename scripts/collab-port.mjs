import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.resolve(root, 'server/collab-server/.env');

let port = 2529;
try {
  const content = fs.readFileSync(envPath, 'utf8');
  const match = content.match(/^PORT\s*=\s*(\d+)/m);
  if (match) port = Number(match[1]);
} catch {
  // default
}

process.stdout.write(String(port));
