/**
 * Utilitários partilhados por dev:all e start:vps (portas, health, processos).
 */
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const COLLAB_ENV_PATH = path.resolve(ROOT, 'server/collab-server/.env');
export const VITE_PORT = 5174;

export function getCollabPort() {
  try {
    const match = fs.readFileSync(COLLAB_ENV_PATH, 'utf8').match(/^PORT\s*=\s*(\d+)/m);
    if (match) return Number(match[1]);
  } catch {
    /* ignore */
  }
  return 2529;
}

export function collabHealthUrl(port = getCollabPort()) {
  return `http://127.0.0.1:${port}/health`;
}

/** Encerra processos que estão escutando na porta. */
export function freePort(port, logPrefix = '[board]') {
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
          console.log(`${logPrefix} liberou porta ${port} (PID ${pid})`);
        } catch {
          /* ignore */
        }
      }
      return;
    }
    execSync(`lsof -ti :${port} | xargs -r kill -9`, { stdio: 'ignore' });
    console.log(`${logPrefix} liberou porta ${port}`);
  } catch {
    /* porta já livre */
  }
}

/** Executa comando e termina o processo em caso de falha. */
export function runStepOrExit(logPrefix, label, command, args, cwd = ROOT) {
  console.log(`${logPrefix} ${label}...`);
  try {
    execSync([command, ...args].join(' '), {
      cwd,
      stdio: 'inherit',
      shell: true,
    });
  } catch (err) {
    const code = err.status ?? 1;
    console.error(`\n${logPrefix} ERRO: ${label} falhou (código ${code}).`);
    console.error(`${logPrefix} Corrija o erro acima antes de voltar a subir o VPS.\n`);
    process.exit(code);
  }
}

export async function waitForHealth(url, timeoutMs = 60000, logPrefix = '[board]') {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        console.log(`${logPrefix} collab OK em ${url}`);
        return;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Collab não respondeu em ${url} (${timeoutMs}ms)`);
}

export function createProcessRunner(logPrefix) {
  const children = [];

  function run(name, command, args, cwd = ROOT) {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('exit', (code) => {
      if (code && code !== 0) {
        console.error(`${logPrefix} ${name} saiu com código ${code}`);
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

  return { run, shutdown, children };
}

export function assertCollabEnv(logPrefix) {
  if (!fs.existsSync(COLLAB_ENV_PATH)) {
    console.error(`${logPrefix} ERRO: ficheiro em falta: server/collab-server/.env`);
    console.error(`${logPrefix} Copie de server/collab-server/.env.example e configure PORT, Supabase, etc.\n`);
    process.exit(1);
  }
}

export function assertDistBuild(logPrefix) {
  const indexPath = path.resolve(ROOT, 'dist/index.html');
  if (!fs.existsSync(indexPath)) {
    console.error(`${logPrefix} ERRO: dist/index.html não encontrado. O build do frontend falhou ou não foi executado.\n`);
    process.exit(1);
  }
}
