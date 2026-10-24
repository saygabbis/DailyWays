/**
 * Teste ponta a ponta de sincronização (nada toca o Supabase de produção):
 *   Supabase falso (PGlite + PostgREST/Auth emulados) + collab-server REAL + build do app +
 *   duas pessoas (dois navegadores) no mesmo board.
 *
 *   node e2e/run.mjs            # build + testes
 *   node e2e/run.mjs --no-build # reaproveita dist-e2e/
 *   E2E_HEADED=1 node e2e/run.mjs
 *
 * Chromium: usa o do Playwright; PW_CHROMIUM=caminho/chrome.exe para outro.
 */
import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startFakeSupabase } from './fakeSupabase.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const SUPA_PORT = 54321;
const COLLAB_PORT = 2599;
const APP_PORT = 4173;
const APP = `http://127.0.0.1:${APP_PORT}`;

const U1 = { id: '00000000-0000-4000-8000-0000000000a1', username: 'gabbis-e2e', name: 'Gabbis E2E', email: 'gabbis@e2e.test' };
const U2 = { id: '00000000-0000-4000-8000-0000000000b2', username: 'amiga-e2e', name: 'Amiga E2E', email: 'amiga@e2e.test' };
const BOARD = '10000000-0000-4000-8000-0000000000e2';
const LIST_A = '20000000-0000-4000-8000-0000000000a1';
const LIST_B = '20000000-0000-4000-8000-0000000000b1';

const SEED = `
  INSERT INTO public.boards (id, owner_id, title, position) VALUES ('${BOARD}', '${U1.id}', 'Board E2E', 0);
  INSERT INTO public.board_members (board_id, user_id, role) VALUES ('${BOARD}', '${U1.id}', 'owner'), ('${BOARD}', '${U2.id}', 'editor');
  INSERT INTO public.lists (id, board_id, title, position) VALUES ('${LIST_A}', '${BOARD}', 'Lista A', 0), ('${LIST_B}', '${BOARD}', 'Lista B', 1);
`;

const results = [];
const log = (...a) => console.log('[e2e]', ...a);

function findChromium() {
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

async function waitHttp(url, ms = 30000) {
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

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    try { execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' }); } catch { /* já saiu */ }
  } else {
    child.kill('SIGTERM');
  }
}

async function waitFor(fn, ms = 8000, label = 'condição') {
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

async function check(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t0 });
    log('✔', name, `(${Date.now() - t0} ms)`);
  } catch (err) {
    results.push({ name, ok: false, error: err.message });
    log('✘', name, '-', err.message);
  }
}

const startCollab = () => startProcess('collab', 'node', ['server/collab-server/src/index.js'], {
  SUPABASE_URL: `http://127.0.0.1:${SUPA_PORT}`,
  SUPABASE_ANON_KEY: 'e2e-anon',
  SUPABASE_SERVICE_ROLE_KEY: 'e2e-'.padEnd(160, 'x'),
  PORT: String(COLLAB_PORT),
  CORS_ORIGIN: APP,
  NODE_ENV: 'development',
  COLLAB_FLUSH_MS: '300',
});

async function main() {
  const supa = await startFakeSupabase({ port: SUPA_PORT, users: [U1, U2], seed: SEED });
  log('Supabase falso em', supa.url);

  if (!process.argv.includes('--no-build')) {
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

  let collab = startCollab();
  // Mesmo .env do build: a CSP (aplicada) libera o Supabase e o collab configurados.
  const preview = startProcess('app', 'npx', ['vite', 'preview', '--outDir', 'dist-e2e', '--port', String(APP_PORT), '--host', '127.0.0.1', '--strictPort'], {
    VITE_SUPABASE_URL: supa.url,
    VITE_COLLAB_SERVER_URL: `http://127.0.0.1:${COLLAB_PORT}`,
  });
  const browsers = [];
  try {
    await waitHttp(`http://127.0.0.1:${COLLAB_PORT}/health`);
    await waitHttp(APP);
    log('collab e app no ar');

    const executablePath = findChromium();
    const launch = () => chromium.launch({ headless: !process.env.E2E_HEADED, executablePath });

    const openAs = async (user) => {
      const browser = await launch();
      browsers.push(browser);
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const session = await supa.sessionFor(user.id);
      await context.addInitScript(([s]) => {
        localStorage.setItem('sb-127-auth-token', JSON.stringify(s));
      }, [session]);
      const page = await context.newPage();
      page.errors = [];
      page.consoleLines = [];
      page.on('pageerror', (e) => page.errors.push(e.message));
      page.on('console', (m) => {
        page.consoleLines.push(`${m.type()}: ${m.text()}`);
        if (m.type() === 'error' && /Content Security Policy/.test(m.text())) page.errors.push(`CSP: ${m.text()}`);
      });
      await page.goto(APP);
      try {
        await page.locator('.sidebar', { hasText: 'Board E2E' }).getByText('Board E2E').first().click({ timeout: 20000 });
        await page.locator('.board-list-title', { hasText: 'Lista A' }).first().waitFor({ timeout: 20000 });
      } catch (err) {
        mkdirSync(join(here, 'out'), { recursive: true });
        await page.screenshot({ path: join(here, 'out', `falha-${user.username}.png`) });
        console.log(page.consoleLines.slice(-40).join('\n'));
        throw err;
      }
      return page;
    };

    const addCard = async (page, listTitle, title) => {
      const list = page.locator('.board-list', { has: page.locator('.board-list-title', { hasText: listTitle }) }).first();
      await list.getByRole('button', { name: 'Adicionar tarefa' }).click();
      await list.getByPlaceholder('Título da tarefa...').fill(title);
      await list.getByPlaceholder('Título da tarefa...').press('Enter');
    };
    const sees = (page, text) => page.getByText(text, { exact: true }).first().isVisible();
    const dbCard = async (title) => (await supa.db.query('SELECT c.*, l.title AS list_title FROM public.cards c JOIN public.lists l ON l.id = c.list_id WHERE c.title = $1', [title])).rows[0];

    const a = await openAs(U1);
    const b = await openAs(U2);
    // espera as duas salas prontas (presença do outro aparece)
    await new Promise((r) => setTimeout(r, 1500));

    await check('card criado por A aparece para B e vai ao banco', async () => {
      await addCard(a, 'Lista A', 'Card da Gabbis');
      await waitFor(() => sees(b, 'Card da Gabbis'), 8000, 'B ver o card');
      await waitFor(() => dbCard('Card da Gabbis'), 8000, 'card no banco');
    });

    await check('A e B criando ao mesmo tempo: os dois veem os dois e nada some', async () => {
      await Promise.all([addCard(a, 'Lista A', 'Simultâneo A'), addCard(b, 'Lista B', 'Simultâneo B')]);
      for (const p of [a, b]) {
        await waitFor(async () => (await sees(p, 'Simultâneo A')) && (await sees(p, 'Simultâneo B')), 8000, 'ver os dois cards');
      }
      await waitFor(async () => (await dbCard('Simultâneo A')) && (await dbCard('Simultâneo B')), 8000, 'os dois no banco');
    });

    await check('rajada de 8 cards de A em sequência rápida: todos chegam, na ordem', async () => {
      for (let i = 1; i <= 8; i += 1) await addCard(a, 'Lista B', `Rajada ${i}`);
      await waitFor(async () => {
        const titles = await b.locator('.board-list', { has: b.locator('.board-list-title', { hasText: 'Lista B' }) }).first().locator('.board-card').allInnerTexts();
        const order = titles.map((t) => (/Rajada (\d)/.exec(t) || [])[1]).filter(Boolean).join('');
        return order === '12345678';
      }, 10000, 'ordem 1..8 em B');
      await waitFor(async () => (await supa.db.query(`SELECT count(*)::int AS n FROM public.cards WHERE title LIKE 'Rajada %'`)).rows[0].n === 8, 8000, '8 no banco');
    });

    await check('o save não reescreve linhas sem mudança (sem "engarrafamento" no Realtime)', async () => {
      const before = (await supa.db.query(`SELECT ctid::text AS t FROM public.cards WHERE title = 'Card da Gabbis'`)).rows[0].t;
      await addCard(b, 'Lista B', 'Mais um');
      await waitFor(() => dbCard('Mais um'), 8000, 'novo card no banco');
      const after = (await supa.db.query(`SELECT ctid::text AS t FROM public.cards WHERE title = 'Card da Gabbis'`)).rows[0].t;
      if (before !== after) throw new Error(`card não alterado foi reescrito (${before} → ${after})`);
    });

    await check('collab cai: A continua editando, o navegador grava (fallback) e ao voltar B vê', async () => {
      killTree(collab);
      await new Promise((r) => setTimeout(r, 800));
      await addCard(a, 'Lista A', 'Feito offline');
      await waitFor(() => sees(a, 'Feito offline'), 3000, 'A ver o próprio card');
      await waitFor(() => dbCard('Feito offline'), 15000, 'fallback gravar no banco');
      collab = startCollab();
      await waitHttp(`http://127.0.0.1:${COLLAB_PORT}/health`);
      await b.reload();
      await b.locator('.board-list-title', { hasText: 'Lista A' }).first().waitFor({ timeout: 20000 });
      await waitFor(() => sees(b, 'Feito offline'), 15000, 'B ver depois de recarregar');
      // e o servidor, ao voltar, não apaga o que o fallback gravou
      await addCard(b, 'Lista B', 'Depois de voltar');
      await waitFor(() => dbCard('Depois de voltar'), 10000, 'card pós-retorno no banco');
      if (!(await dbCard('Feito offline'))) throw new Error('card do fallback sumiu depois que o collab voltou');
    });

    await check('nenhum erro de página nem bloqueio da CSP nos dois navegadores', async () => {
      const errs = [...a.errors, ...b.errors];
      if (errs.length) throw new Error(errs.slice(0, 3).join(' | '));
    });
  } finally {
    for (const br of browsers) await br.close().catch(() => {});
    killTree(collab);
    killTree(preview);
    await supa.close();
  }

  const failed = results.filter((r) => !r.ok);
  log(`${results.length - failed.length}/${results.length} ok`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error('[e2e] erro', err);
  process.exit(1);
});
