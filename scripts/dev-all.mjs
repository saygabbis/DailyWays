/**
 * Sobe collab-server, espera /health, depois Vite (Windows + Linux).
 */
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.resolve(root, 'server/collab-server/.env');
const VITE_PORT = 5174;

function getCollabPort() {
  try {
    const match = fs.readFileSync(envPath, 'utf8').match(/^PORT\s*=\s*(\d+)/m);
    if (match) return Number(match[1]);
  } catch {
    /* ignore */
  }
  return 2529;
}

/** Encerra processos que estão escutando na porta (evita collab/vite “fantasma”). */
function freePort(port) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano -p tcp | findstr :${port}`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      const pids = new Set();
      for (const line of out.split('\n')) {
        if (!/LISTENING/i.test(line)) continue;
        const pid = line.trim().split(/\s+/).pop();
        if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid);
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F /T`, { stdio: 'ignore' });
          console.log(`[dev:all] liberou porta ${port} (PID ${pid})`);
        } catch {
          /* ignore */
        }
      }
      return;
    }
    execSync(`lsof -ti :${port} | xargs -r kill -9`, { stdio: 'ignore' });
    console.log(`[dev:all] liberou porta ${port}`);
  } catch {
    /* porta já livre */
  }
}

const port = getCollabPort();
const healthUrl = `http://127.0.0.1:${port}/health`;

const children = [];

function run(name, command, args) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[dev:all] ${name} saiu com código ${code}`);
      shutdown(code);
    }
  });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  for (const c of children) {
    if (!c.killed) {
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', String(c.pid), '/f', '/t'], { shell: true });
        } else {
          c.kill('SIGTERM');
        }
      } catch {
        /* ignore */
      }
    }
  }
  process.exit(code);
}

async function waitForHealth(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        console.log(`[dev:all] collab OK em ${url}`);
        return;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Collab não respondeu em ${url} (${timeoutMs}ms)`);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log(`[dev:all] collab porta ${port} (server/collab-server/.env)`);
console.log('[dev:all] liberando portas antigas (2529 + 5174)...');
freePort(port);
freePort(VITE_PORT);
await new Promise((r) => setTimeout(r, 600));

run('collab', 'npm', ['run', 'dev:collab']);

try {
  await waitForHealth(healthUrl);
} catch (err) {
  console.error('[dev:all]', err.message);
  shutdown(1);
}

run('vite', 'npm', ['run', 'dev']);
