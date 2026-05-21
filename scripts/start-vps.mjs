/**
 * VPS: collab-server (2529) + Vite (5174).
 * O Vite sozinho dá ECONNREFUSED no proxy /socket.io sem o collab.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.resolve(root, 'server/collab-server/.env');

function getCollabPort() {
  try {
    const match = fs.readFileSync(envPath, 'utf8').match(/^PORT\s*=\s*(\d+)/m);
    if (match) return Number(match[1]);
  } catch {
    /* ignore */
  }
  return 2529;
}

const port = getCollabPort();
const healthUrl = `http://127.0.0.1:${port}/health`;
const children = [];

async function isHealthOk(url) {
  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForHealth(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isHealthOk(url)) {
      console.log(`[start:vps] collab OK → ${url}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Collab não respondeu em ${url}. Confira server/collab-server/.env (PORT=${port})`);
}

function run(name, command, args, cwd = root) {
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
  });
  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[start:vps] ${name} saiu com código ${code}`);
      shutdown(code);
    }
  });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  for (const c of children) {
    try {
      c.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log(`[start:vps] collab porta ${port}`);

if (!(await isHealthOk(healthUrl))) {
  console.log('[start:vps] subindo collab-server...');
  run('collab', 'npm', ['run', 'start:collab']);
  try {
    await waitForHealth(healthUrl);
  } catch (err) {
    console.error('[start:vps]', err.message);
    shutdown(1);
  }
} else {
  console.log('[start:vps] collab já estava rodando');
}

console.log('[start:vps] subindo Vite (5174)...');
run('vite', 'npm', ['run', 'dev', '--', '--host']);
