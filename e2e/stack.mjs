/**
 * Ambiente local completo para testes e capturas: Supabase falso (PGlite) + collab-server real +
 * build do app servido pelo `vite preview`. Nada toca o Supabase de produção.
 */
import { spawn, execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startFakeSupabase } from './fakeSupabase.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const repo = join(here, '..');
export const SUPA_PORT = 54321;
export const COLLAB_PORT = 2599;
export const APP_PORT = 4173;
export const APP = `http://127.0.0.1:${APP_PORT}`;

export const log = (...a) => console.log('[e2e]', ...a);

export function findChromium() {
  if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
  const base = join(homedir(), 'AppData/Local/ms-playwright');
  if (!existsSync(base)) return undefined;
  const dirs = readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse();
  for (const d of dirs) {
    for (const sub of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux/chrome']) {
      const p = join(base, d, sub);
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}

function startProcess(name, cmd, args, env) {
  const child = spawn(cmd, args, { cwd: repo, env: { ...process.env, ...env }, shell: process.platform === 'win32' });
  child.stdout.on('data', (d) => { if (process.env.E2E_VERBOSE) process.stdout.write(`[${name}] ${d}`); });
  child.stderr.on('data', (d) => { if (process.env.E2E_VERBOSE) process.stderr.write(`[${name}] ${d}`); });
  return child;
}

export async function waitHttp(url, ms = 30000) {
  const start = Date.now();
  for (;;) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch { /* ainda subindo */ }
    if (Date.now() - start > ms) throw new Error(`timeout: ${url}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

export function killTree(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    try { execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' }); } catch { /* já saiu */ }
  } else {
    child.kill('SIGTERM');
  }
}

export async function waitFor(fn, ms = 8000, label = 'condição') {
  const start = Date.now();
  let last;
  for (;;) {
    try {
      last = await fn();
      if (last) return last;
    } catch (err) { last = err; }
    if (Date.now() - start > ms) throw new Error(`timeout esperando ${label}${last instanceof Error ? `: ${last.message}` : ''}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

export const startCollab = () => startProcess('collab', 'node', ['server/collab-server/src/index.js'], {
  SUPABASE_URL: `http://127.0.0.1:${SUPA_PORT}`,
  SUPABASE_ANON_KEY: 'e2e-anon',
  SUPABASE_SERVICE_ROLE_KEY: 'e2e-'.padEnd(160, 'x'),
  PORT: String(COLLAB_PORT),
  CORS_ORIGIN: APP,
  NODE_ENV: 'development',
  COLLAB_FLUSH_MS: '300',
});

/**
 * Sobe tudo. `build: false` reaproveita dist-e2e/.
 * @returns {Promise<{ supa, collab, restartCollab, stopCollab, openAs, close }>}
 */
export async function startStack({ users, seed = '', build = true } = {}) {
  const supa = await startFakeSupabase({ port: SUPA_PORT, users, seed });
  log('Supabase falso em', supa.url);

  if (build) {
    log('build do app (dist-e2e)…');
    execSync('npx vite build --outDir dist-e2e --emptyOutDir', {
      cwd: repo,
      stdio: process.env.E2E_VERBOSE ? 'inherit' : 'ignore',
      env: {
        ...process.env,
        VITE_SUPABASE_URL: supa.url,
        VITE_SUPABASE_ANON_KEY: 'e2e-anon',
        VITE_COLLAB_SERVER_URL: `http://127.0.0.1:${COLLAB_PORT}`,
        VITE_PUBLIC_SITE_URL: APP,
      },
    });
  }

  const stack = { supa, collab: startCollab() };
  // Mesmo .env do build: a CSP (aplicada) libera o Supabase e o collab configurados.
  stack.preview = startProcess('app', 'npx', ['vite', 'preview', '--outDir', 'dist-e2e', '--port', String(APP_PORT), '--host', '127.0.0.1', '--strictPort'], {
    VITE_SUPABASE_URL: supa.url,
    VITE_COLLAB_SERVER_URL: `http://127.0.0.1:${COLLAB_PORT}`,
  });
  stack.browsers = [];

  await waitHttp(`http://127.0.0.1:${COLLAB_PORT}/health`);
  await waitHttp(APP);
  log('collab e app no ar');

  stack.stopCollab = () => killTree(stack.collab);
  stack.restartCollab = async () => {
    stack.collab = startCollab();
    await waitHttp(`http://127.0.0.1:${COLLAB_PORT}/health`);
  };

  /** Navegador logado como `user` (sessão injetada no localStorage). */
  stack.openAs = async (user, { viewport = { width: 1440, height: 900 }, isMobile = false, colorScheme, init } = {}) => {
    const browser = await chromium.launch({ headless: !process.env.E2E_HEADED, executablePath: findChromium() });
    stack.browsers.push(browser);
    const context = await browser.newContext({ viewport, isMobile, hasTouch: isMobile, colorScheme, deviceScaleFactor: isMobile ? 2 : 1 });
    const session = await supa.sessionFor(user.id);
    await context.addInitScript(([s, extra]) => {
      localStorage.setItem('sb-127-auth-token', JSON.stringify(s));
      for (const [k, v] of Object.entries(extra || {})) localStorage.setItem(k, v);
    }, [session, init]);
    const page = await context.newPage();
    page.errors = [];
    page.consoleLines = [];
    page.on('pageerror', (e) => page.errors.push(e.message));
    page.on('console', (m) => {
      page.consoleLines.push(`${m.type()}: ${m.text()}`);
      if (m.type() === 'error' && /Content Security Policy/.test(m.text())) page.errors.push(`CSP: ${m.text()}`);
    });
    return page;
  };

  stack.close = async () => {
    for (const br of stack.browsers) await br.close().catch(() => {});
    killTree(stack.collab);
    killTree(stack.preview);
    await supa.close();
  };
  return stack;
}
