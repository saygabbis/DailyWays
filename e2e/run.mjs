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
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP, log, startStack, waitFor } from './stack.mjs';

const here = dirname(fileURLToPath(import.meta.url));

const U1 = { id: '00000000-0000-4000-8000-0000000000a1', username: 'gabbis-e2e', name: 'Gabbis E2E', email: 'gabbis@e2e.test' };
const U2 = { id: '00000000-0000-4000-8000-0000000000b2', username: 'amiga-e2e', name: 'Amiga E2E', email: 'amiga@e2e.test' };
const BOARD = '10000000-0000-4000-8000-0000000000e2';
const LIST_A = '20000000-0000-4000-8000-0000000000a1';
const LIST_B = '20000000-0000-4000-8000-0000000000b1';
const SPACE = '40000000-0000-4000-8000-0000000000e2';

const SEED = `
  INSERT INTO public.boards (id, owner_id, title, position) VALUES ('${BOARD}', '${U1.id}', 'Board E2E', 0);
  INSERT INTO public.board_members (board_id, user_id, role) VALUES ('${BOARD}', '${U1.id}', 'owner'), ('${BOARD}', '${U2.id}', 'editor');
  INSERT INTO public.lists (id, board_id, title, position) VALUES ('${LIST_A}', '${BOARD}', 'Lista A', 0), ('${LIST_B}', '${BOARD}', 'Lista B', 1);
  INSERT INTO public.spaces (id, owner_id, title, emoji, position) VALUES ('${SPACE}', '${U1.id}', 'Space E2E', '🧪', 0);
`;

const results = [];

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

async function main() {
  const stack = await startStack({ users: [U1, U2], seed: SEED, build: !process.argv.includes('--no-build') });
  const { supa } = stack;
  try {
    const openAs = async (user) => {
      const page = await stack.openAs(user);
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

    /** Arraste com mouse de verdade (vários passos, como uma pessoa). */
    const drag = async (page, from, to, { dy = 0 } = {}) => {
      await from.scrollIntoViewIfNeeded();
      const s = await from.boundingBox();
      const t = await to.boundingBox();
      await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
      await page.mouse.down();
      await page.mouse.move(s.x + s.width / 2 + 8, s.y + s.height / 2 + 8, { steps: 4 });
      await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2 + dy, { steps: 18 });
      await page.waitForTimeout(150);
      await page.mouse.up();
    };
    const cardEl = (page, title) => page.locator('.board-card', { hasText: title }).first();
    const listEl = (page, title) => page.locator('.board-list', { has: page.locator('.board-list-title', { hasText: title }) }).first();

    await check('arrastar card para outra lista: move para A, B vê e o banco grava', async () => {
      await drag(a, cardEl(a, 'Card da Gabbis'), listEl(a, 'Lista B').locator('.board-list-cards'));
      await waitFor(async () => (await dbCard('Card da Gabbis'))?.list_title === 'Lista B', 8000, 'banco com o card na Lista B');
      await waitFor(async () => (await listEl(b, 'Lista B').locator('.board-card', { hasText: 'Card da Gabbis' }).count()) === 1, 8000, 'B ver na Lista B');
    });

    await check('reordenar lista arrastando o cabeçalho', async () => {
      await drag(a, listEl(a, 'Lista B').locator('.board-list-header'), listEl(a, 'Lista A').locator('.board-list-header'));
      await waitFor(async () => {
        const rows = (await supa.db.query(`SELECT title FROM public.lists WHERE board_id = $1 ORDER BY position`, [BOARD])).rows;
        return rows[0]?.title === 'Lista B';
      }, 8000, 'Lista B primeiro no banco');
      await waitFor(async () => (await b.locator('.board-list-title').first().innerText()).includes('Lista B'), 8000, 'B ver a ordem nova');
    });

    await check('selecionar duas colunas (Ctrl+clique) e pintar as duas de uma vez', async () => {
      await a.locator('.board-list-title', { hasText: 'Lista A' }).first().click({ modifiers: ['Control'] });
      await a.locator('.board-list-title', { hasText: 'Lista B' }).first().click({ modifiers: ['Control'] });
      await waitFor(() => a.getByRole('toolbar', { name: 'Colunas selecionadas' }).getByText('2 colunas').isVisible(), 5000, 'barra com 2 colunas');
      await a.getByRole('button', { name: 'Cor #22c55e' }).click();
      await waitFor(async () => {
        const rows = (await supa.db.query('SELECT color FROM public.lists WHERE board_id = $1', [BOARD])).rows;
        return rows.length === 2 && rows.every((r) => r.color === '#22c55e');
      }, 8000, 'as duas listas verdes no banco');
      await a.keyboard.press('Escape');
      await waitFor(async () => !(await a.getByRole('toolbar', { name: 'Colunas selecionadas' }).isVisible().catch(() => false)), 3000, 'barra fechada');
    });

    await check('soltar card em "Diário" na sidebar marca para hoje', async () => {
      await drag(a, cardEl(a, 'Mais um'), a.locator('.sb-today').getByRole('button', { name: /Diário/ }));
      try {
        await waitFor(async () => (await dbCard('Mais um'))?.my_day === true, 8000, 'my_day no banco');
      } catch (err) {
        console.log(a.consoleLines.filter((l) => /dnd-debug/.test(l)).slice(-4).join('\n'));
        await a.screenshot({ path: join(here, 'out', 'falha-diario.png') });
        throw err;
      }
    });

    await check('concluir pela Visão Geral grava no banco e B vê', async () => {
      await a.locator('.sidebar').getByText('Visão Geral').first().click();
      await a.getByRole('button', { name: 'Concluir "Mais um"' }).click();
      await waitFor(async () => (await dbCard('Mais um'))?.completed === true, 8000, 'completed no banco');
      await a.locator('.sidebar').getByText('Board E2E').first().click();
      await a.locator('.board-list-title', { hasText: 'Lista A' }).first().waitFor({ timeout: 10000 });
      await waitFor(async () => (await b.locator('.board-card.board-card-done-state', { hasText: 'Mais um' }).count()) === 1, 8000, 'B ver concluído');
    });

    await check('clique no card ainda abre o card (arrastar não engole o clique)', async () => {
      await cardEl(a, 'Simultâneo A').click();
      await waitFor(() => a.locator('.task-detail-modal').first().isVisible(), 5000, 'modal aberto');
      // apagar letra com Shift+Backspace no título não pode excluir o card
      await a.locator('.task-detail-title').click();
      await a.keyboard.press('End');
      await a.keyboard.press('Shift+Backspace');
      await a.waitForTimeout(400);
      if (await a.locator('.confirm-modal, [role=alertdialog]').first().isVisible().catch(() => false)) throw new Error('abriu confirmação de excluir');
      await a.keyboard.press('Escape');
      await waitFor(async () => !(await a.locator('.task-detail-modal').first().isVisible().catch(() => false)), 5000, 'modal fechado');
    });

    await check('collab cai: A continua editando, o navegador grava (fallback) e ao voltar B vê', async () => {
      stack.stopCollab();
      await new Promise((r) => setTimeout(r, 800));
      await addCard(a, 'Lista A', 'Feito offline');
      await waitFor(() => sees(a, 'Feito offline'), 3000, 'A ver o próprio card');
      await waitFor(() => dbCard('Feito offline'), 15000, 'fallback gravar no banco');
      await stack.restartCollab();
      await b.reload();
      await b.locator('.board-list-title', { hasText: 'Lista A' }).first().waitFor({ timeout: 20000 });
      await waitFor(() => sees(b, 'Feito offline'), 15000, 'B ver depois de recarregar');
      // e o servidor, ao voltar, não apaga o que o fallback gravou
      await addCard(b, 'Lista B', 'Depois de voltar');
      await waitFor(() => dbCard('Depois de voltar'), 10000, 'card pós-retorno no banco');
      if (!(await dbCard('Feito offline'))) throw new Error('card do fallback sumiu depois que o collab voltou');
    });

    await check('imagem grande no Space: sobe reduzida (WebP ≤ 2560 px) com miniatura e aparece', async () => {
      await a.locator('.sidebar').getByText('Space E2E').first().click();
      await a.locator('.whiteboard-viewport').first().waitFor({ timeout: 15000 });
      const b64 = await a.evaluate(() => {
        const c = document.createElement('canvas');
        c.width = 3000;
        c.height = 2000;
        const g = c.getContext('2d');
        const grad = g.createLinearGradient(0, 0, 3000, 2000);
        grad.addColorStop(0, '#7c3aed');
        grad.addColorStop(1, '#22c55e');
        g.fillStyle = grad;
        g.fillRect(0, 0, 3000, 2000);
        return c.toDataURL('image/png').split(',')[1];
      });
      await a.locator('input[type=file][accept="image/*"]').first().setInputFiles({ name: 'grande.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
      await waitFor(() => [...supa.objects.keys()].some((k) => k.endsWith('.thumb.webp')), 15000, 'miniatura no storage');
      const keys = [...supa.objects.keys()].filter((k) => k.startsWith(`space-assets/${SPACE}/`));
      const main = keys.find((k) => !k.endsWith('.thumb.webp'));
      if (!main?.endsWith('.webp')) throw new Error(`arquivo principal não virou webp: ${keys.join(', ')}`);
      const dims = await a.evaluate(async (bytes) => {
        const bmp = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/webp' }));
        return [bmp.width, bmp.height];
      }, [...supa.objects.get(main).buf]);
      if (Math.max(...dims) > 2560) throw new Error(`não reduziu: ${dims}`);
      await waitFor(async () => {
        const r = (await supa.db.query(`SELECT data_json FROM public.space_nodes WHERE space_id = $1 AND type = 'image'`, [SPACE])).rows[0];
        const data = typeof r?.data_json === 'string' ? JSON.parse(r.data_json) : r?.data_json;
        return data?.thumbStoragePath?.endsWith('.thumb.webp');
      }, 10000, 'nó com thumbStoragePath no banco');
      await waitFor(() => a.locator('.whiteboard-image-svg image').first().isVisible(), 10000, 'imagem visível no canvas');
    });

    await check('caneta no Space: arrastar desenha um traço vetorial que vai ao banco', async () => {
      await a.getByRole('button', { name: 'Caneta' }).first().click();
      const vp = await a.locator('.whiteboard-viewport').first().boundingBox();
      const x0 = vp.x + vp.width * 0.3;
      const y0 = vp.y + vp.height * 0.3;
      await a.mouse.move(x0, y0);
      await a.mouse.down();
      for (let i = 1; i <= 30; i += 1) await a.mouse.move(x0 + i * 6, y0 + Math.sin(i / 4) * 40);
      await a.mouse.up();
      await waitFor(async () => {
        const r = (await supa.db.query(`SELECT data_json FROM public.space_nodes WHERE space_id = $1 AND type = 'drawing'`, [SPACE])).rows[0];
        const data = typeof r?.data_json === 'string' ? JSON.parse(r.data_json) : r?.data_json;
        return data?.freehand === true && /^M [\d.]+ [\d.]+ Q /.test(data.paths?.[0]?.d || '');
      }, 10000, 'desenho no banco');
      await waitFor(() => a.locator('.drawing-node--freehand path').first().isVisible(), 5000, 'traço visível');
      await a.keyboard.press('Escape');
    });

    await check('conexão rápida: o "+" ao lado do nó cria uma nota já conectada', async () => {
      await a.keyboard.press('Escape');
      const drawing = a.locator('.whiteboard-node-wrapper', { has: a.locator('.drawing-node--freehand') }).first();
      const box = await drawing.boundingBox();
      await a.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await a.getByRole('button', { name: 'Novo item conectado à direita' }).click();
      await waitFor(async () => (await supa.db.query(`SELECT count(*)::int AS n FROM public.space_connectors WHERE space_id = $1`, [SPACE])).rows[0].n === 1, 10000, 'conector no banco');
      const conn = (await supa.db.query(`SELECT c.*, n.type AS to_type FROM public.space_connectors c JOIN public.space_nodes n ON n.id = c.to_node_id WHERE c.space_id = $1`, [SPACE])).rows[0];
      if (conn.to_type !== 'sticky_note') throw new Error(`nó criado é ${conn.to_type}`);
      await a.keyboard.press('Escape');
      await waitFor(() => a.locator('.connector-layer path').first().isVisible(), 5000, 'conector visível');
    });

    await check('exportar a página do Space como PNG (Ctrl+Shift+E) baixa uma imagem com o conteúdo', async () => {
      await a.locator('.whiteboard-viewport').first().click({ position: { x: 20, y: 20 } });
      const [download] = await Promise.all([
        a.waitForEvent('download', { timeout: 20000 }),
        a.keyboard.press('Control+Shift+E'),
      ]);
      if (!/-pagina\.png$/.test(download.suggestedFilename())) throw new Error(`nome: ${download.suggestedFilename()}`);
      mkdirSync(join(here, 'out'), { recursive: true });
      await download.saveAs(join(here, 'out', 'export-pagina.png'));
      const chunks = [];
      for await (const c of await download.createReadStream()) chunks.push(c);
      const png = Buffer.concat(chunks);
      if (png.subarray(1, 4).toString() !== 'PNG') throw new Error('não é PNG');
      const w = png.readUInt32BE(16);
      const h = png.readUInt32BE(20);
      if (w < 1000 || h < 600) throw new Error(`imagem pequena demais: ${w}x${h}`);
    });

    await check('nenhum erro de página nem bloqueio da CSP nos dois navegadores', async () => {
      const errs = [...a.errors, ...b.errors];
      if (errs.length) throw new Error(errs.slice(0, 3).join(' | '));
    });
  } finally {
    await stack.close();
  }

  const failed = results.filter((r) => !r.ok);
  log(`${results.length - failed.length}/${results.length} ok`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error('[e2e] erro', err);
  process.exit(1);
});
