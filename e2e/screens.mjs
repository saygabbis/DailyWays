/**
 * Capturas de todas as telas (desktop e celular, tema escuro e claro) com dados de exemplo.
 * Uso: node e2e/screens.mjs [--no-build] [--only=dashboard,board] [--theme=dark|light]
 * Saída: e2e/out/screens/<tela>-<formato>-<tema>.png
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP, log, startStack } from './stack.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, 'out', 'screens');
mkdirSync(outDir, { recursive: true });

const ME = { id: '00000000-0000-4000-8000-0000000000a1', username: 'gabbis', name: 'Gabbis', email: 'gabbis@e2e.test' };
const FRIEND = { id: '00000000-0000-4000-8000-0000000000b2', username: 'kzer0', name: 'Kzer0', email: 'kzer0@e2e.test' };

const id = (prefix, n) => `${prefix}0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const G_WORK = id('9', 1);
const G_PERSONAL = id('9', 2);
const B_APP = id('1', 1);
const B_STUDY = id('1', 2);
const B_HOME = id('1', 3);
const S_LAYOUT = id('4', 1);

const lists = [
  [id('2', 1), B_APP, 'Adicionar', 0, '#22c55e'],
  [id('2', 2), B_APP, 'Corrigir', 1, '#8b5cf6'],
  [id('2', 3), B_APP, 'Melhorar', 2, '#f97316'],
  [id('2', 4), B_APP, 'Feito', 3, '#10b981', true],
  [id('2', 5), B_STUDY, 'Estudar', 0, null],
  [id('2', 6), B_STUDY, 'Revisar', 1, null],
  [id('2', 7), B_HOME, 'Casa', 0, null],
];

const cards = [
  [1, 1, 'Adicionar "papel" nas pastas para criar boards mais rápido', 'none', null],
  [2, 1, 'Histórico de grupos em Convites', 'medium', '2 days'],
  [3, 1, 'Lista de amigos para adicionar nos lugares', 'low', null],
  [4, 2, 'Mouse de outra pessoa teletransporta ao rolar', 'high', '-1 days'],
  [5, 2, 'Capa não aparece nas tarefas', 'urgent', '0 days'],
  [6, 2, 'Arrastar card para as bordas não rola o board', 'medium', '1 days'],
  [7, 3, 'Otimizar imagens grandes no Space', 'high', '5 days'],
  [8, 3, 'Melhorar a navegação no celular', 'medium', null],
  [9, 4, 'Adicionar chat', 'none', null, true],
  [10, 4, 'Notificações em tempo real', 'none', null, true],
  [11, 5, 'Capítulo 3 de cálculo', 'high', '0 days'],
  [12, 5, 'Lista de exercícios', 'medium', '3 days'],
  [13, 6, 'Revisar anotações da aula', 'low', null],
  [14, 7, 'Pagar conta de luz', 'urgent', '-2 days'],
  [15, 7, 'Comprar café', 'none', '1 days'],
];

const SEED = `
  INSERT INTO public.privacy_settings (user_id) VALUES ('${ME.id}'), ('${FRIEND.id}');
  INSERT INTO public.groups (id, owner_id, title, type, position, is_expanded) VALUES
    ('${G_WORK}', '${ME.id}', 'Projetos', 'board', 0, true),
    ('${G_PERSONAL}', '${ME.id}', 'Pessoal', 'board', 1, true);
  INSERT INTO public.boards (id, owner_id, title, emoji, color, position, group_id) VALUES
    ('${B_APP}', '${ME.id}', 'Objetivos - DailyWays', '📝', '#f43f5e', 0, '${G_WORK}'),
    ('${B_STUDY}', '${ME.id}', 'Faculdade', '📚', '#6366f1', 1, '${G_PERSONAL}'),
    ('${B_HOME}', '${ME.id}', 'Casa', '🏠', '#14b8a6', 2, NULL);
  INSERT INTO public.board_members (board_id, user_id, role) VALUES
    ('${B_APP}', '${ME.id}', 'owner'), ('${B_APP}', '${FRIEND.id}', 'editor'),
    ('${B_STUDY}', '${ME.id}', 'owner'), ('${B_HOME}', '${ME.id}', 'owner');
  INSERT INTO public.lists (id, board_id, title, position, color, is_completion_list) VALUES
    ${lists.map(([lid, bid, t, p, c, done]) => `('${lid}', '${bid}', '${t}', ${p}, ${c ? `'${c}'` : 'NULL'}, ${done ? 'true' : 'false'})`).join(',\n    ')};
  INSERT INTO public.cards (id, list_id, title, priority, due_date, position, completed, my_day, labels) VALUES
    ${cards.map(([n, li, t, pr, due, done], i) => `('${id('3', n)}', '${id('2', li)}', '${t.replace(/'/g, "''")}', '${pr}', ${due ? `now() + interval '${due}'` : 'NULL'}, ${i}, ${done ? 'true' : 'false'}, ${n % 4 === 0 ? 'true' : 'false'}, '[]'::jsonb)`).join(',\n    ')};
  INSERT INTO public.subtasks (card_id, title, done, position) VALUES
    ('${id('3', 5)}', 'Reproduzir', true, 0), ('${id('3', 5)}', 'Corrigir', false, 1), ('${id('3', 5)}', 'Testar', false, 2),
    ('${id('3', 11)}', 'Derivadas', true, 0), ('${id('3', 11)}', 'Integrais', false, 1);
  INSERT INTO public.spaces (id, owner_id, title, emoji, position) VALUES ('${S_LAYOUT}', '${ME.id}', 'Layout - DailyWays', '🎨', 0);
  INSERT INTO public.space_nodes (space_id, type, x, y, width, height, data_json, z_index) VALUES
    ('${S_LAYOUT}', 'sticky_note', 120, 120, 220, 160, '{"text":"Ideias para a Visão Geral"}', 1),
    ('${S_LAYOUT}', 'sticky_note', 400, 160, 220, 160, '{"text":"Menos informação por tela"}', 2),
    ('${S_LAYOUT}', 'text', 120, 360, 320, 60, '{"text":"Redesign 2026"}', 3),
    ('${S_LAYOUT}', 'shape', 520, 380, 160, 120, '{"shape":"rect"}', 4);
  INSERT INTO public.contacts (user_id, contact_user_id) VALUES ('${ME.id}', '${FRIEND.id}'), ('${FRIEND.id}', '${ME.id}');
`;

const SCREENS = {
  dashboard: async (page) => { await page.getByText('Visão Geral').first().click(); },
  myday: async (page) => { await page.getByText('Diário').first().click(); },
  important: async (page) => { await page.getByText('Importante').first().click(); },
  planned: async (page) => { await page.getByText('Planejado').first().click(); },
  board: async (page) => { await page.getByText('Objetivos - DailyWays').first().click(); await page.waitForTimeout(800); },
  card: async (page) => {
    await page.getByText('Objetivos - DailyWays').first().click();
    await page.getByText('Capa não aparece nas tarefas').first().click();
  },
  space: async (page) => { await page.getByText('Layout - DailyWays').first().click(); await page.waitForTimeout(1200); },
  contacts: async (page) => { await page.getByText('Contatos').first().click(); },
  settings: async (page) => { await page.getByText('Configurações').first().click(); },
};

function parseArgs() {
  const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const [k, v] = a.slice(2).split('=');
    return [k, v ?? true];
  }));
  return {
    build: !args['no-build'],
    only: args.only ? String(args.only).split(',') : Object.keys(SCREENS),
    themes: args.theme ? String(args.theme).split(',') : ['dark'],
    formats: args.format ? String(args.format).split(',') : ['desktop', 'mobile'],
  };
}

const FORMATS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true },
};

async function main() {
  const opts = parseArgs();
  const stack = await startStack({ users: [ME, FRIEND], seed: SEED, build: opts.build });
  try {
    for (const theme of opts.themes) {
      for (const format of opts.formats) {
        for (const name of opts.only) {
          const page = await stack.openAs(ME, {
            ...FORMATS[format],
            init: { dailyways_theme: JSON.stringify(theme), dailyways_onboarding_done: '1' },
          });
          await page.goto(APP);
          await page.waitForTimeout(1500);
          try {
            if (format === 'mobile' && name !== 'dashboard') {
              const menu = page.getByRole('button', { name: /menu|abrir navegação/i }).first();
              if (await menu.isVisible().catch(() => false)) await menu.click();
            }
            await SCREENS[name](page);
            await page.waitForTimeout(900);
          } catch (err) {
            log('⚠', name, format, err.message.split('\n')[0]);
          }
          const file = join(outDir, `${name}-${format}-${theme}.png`);
          await page.screenshot({ path: file });
          log('📸', file.replace(here, 'e2e'));
          if (page.errors.length) log('  erros:', page.errors.slice(0, 3).join(' | '));
          await page.context().browser().close();
        }
      }
    }
  } finally {
    await stack.close();
  }
}

main().catch((err) => {
  console.error('[screens] erro', err);
  process.exit(1);
});
