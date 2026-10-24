/**
 * Integração do collab-server: socket.io de verdade + Postgres embutido (PGlite) com o espelho do
 * schema e a upsert_board_full do repositório. O "Supabase" é um cliente falso que traduz as
 * consultas do servidor para SQL; os tokens são falsos (tok-<usuário>).
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';

process.env.COLLAB_FLUSH_MS = '30';
process.env.COLLAB_IDLE_BOARD_RELOAD_MS = '50';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '../../../..');
const read = (rel) => readFileSync(join(repo, rel), 'utf8');

const U1 = '00000000-0000-4000-8000-000000000001'; // dono
const U2 = '00000000-0000-4000-8000-000000000002'; // editor
const U3 = '00000000-0000-4000-8000-000000000003'; // sem acesso
const BOARD = '10000000-0000-4000-8000-000000000001';
const OTHER_BOARD = '10000000-0000-4000-8000-000000000002';
const L1 = '20000000-0000-4000-8000-000000000001';
const L2 = '20000000-0000-4000-8000-000000000002';
const C1 = '30000000-0000-4000-8000-000000000001';

const TOKENS = { 'tok-u1': U1, 'tok-u2': U2, 'tok-u3': U3, 'tok-u1-new': U1 };
const expired = new Set();

let db;
let httpServer;
let url;
const sockets = [];

/** Cliente "Supabase" mínimo sobre o PGlite (só o que o servidor usa). */
function fakeDbClient(token) {
  const userId = TOKENS[token];
  if (!userId) return null;
  const from = (table) => {
    const where = [];
    const params = [];
    let cols = '*';
    let order = '';
    let single = false;
    const q = {
      select(c) { cols = c; return q; },
      eq(col, val) { params.push(val); where.push(`${col} = $${params.length}`); return q; },
      in(col, vals) { params.push(vals); where.push(`${col} = ANY($${params.length})`); return q; },
      order(col, { ascending = true } = {}) { order = ` ORDER BY ${col} ${ascending ? 'ASC' : 'DESC'}`; return q; },
      maybeSingle() { single = true; return q; },
      then(resolve, reject) {
        const sql = `SELECT ${cols} FROM public.${table}${where.length ? ` WHERE ${where.join(' AND ')}` : ''}${order}`;
        return db.query(sql, params).then(({ rows }) => resolve({
          data: single ? rows[0] ?? null : rows,
          error: null,
        }), reject);
      },
    };
    return q;
  };
  return {
    from,
    async rpc(name, args) {
      if (expired.has(token)) return { data: null, error: { code: 'PGRST301', message: 'JWT expired' } };
      assert.equal(name, 'upsert_board_full');
      await db.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: userId })]);
      const { rows } = await db.query('SELECT public.upsert_board_full($1::jsonb) AS r', [JSON.stringify(args.p_board)]);
      return { data: rows[0].r, error: null };
    },
  };
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const s = ioClient(url, { auth: { token }, transports: ['websocket'], forceNew: true, reconnection: false });
    sockets.push(s);
    s.once('connect', () => resolve(s));
    s.once('connect_error', reject);
  });
}

const emit = (s, event, payload) => new Promise((resolve) => s.emit(event, payload, resolve));

function collect(s, event) {
  const got = [];
  s.on(event, (p) => got.push(p));
  return got;
}

async function waitFor(fn, ms = 3000) {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - start > ms) throw new Error('timeout esperando condição');
    await new Promise((r) => setTimeout(r, 20));
  }
}

const cardRow = async () => (await db.query('SELECT * FROM public.cards WHERE id = $1', [C1])).rows[0];
let opSeq = 0;
const op = (action, boardId = BOARD) => ({
  opId: `op-${++opSeq}`, type: 'update', entity: 'board', id: boardId, field: 'action', value: action, clientTs: Date.now(),
});
const updateCard = (updates, listId = L1) => ({ type: 'UPDATE_CARD', payload: { boardId: BOARD, listId, cardId: C1, updates } });

let EVENTS;

describe('collab-server (integração com Postgres embutido)', () => {
  before(async () => {
    db = new PGlite();
    await db.exec(read('supabase/tests/schemaMirror.sql'));
    await db.exec(read('supabase/migrations/20261024190000_upsert_board_full_diff_and_idor.sql'));
    await db.exec(read('supabase/migrations/20261024200000_upsert_board_full_day_category.sql'));
    await db.exec(`
      INSERT INTO public.profiles (id, username) VALUES ('${U3}', 'u3');
      INSERT INTO public.boards (id, owner_id, title) VALUES ('${BOARD}', '${U1}', 'Board'), ('${OTHER_BOARD}', '${U1}', 'Outro');
      INSERT INTO public.board_members (board_id, user_id, role) VALUES ('${BOARD}', '${U2}', 'editor');
      INSERT INTO public.lists (id, board_id, title, position) VALUES ('${L1}', '${BOARD}', 'A fazer', 0), ('${L2}', '${BOARD}', 'Feito', 1);
      INSERT INTO public.cards (id, list_id, title, position) VALUES ('${C1}', '${L1}', 'Card', 0);
    `);

    const { setDbClientFactoryForTests } = await import('../db/supabase.js');
    const { setTokenVerifierForTests } = await import('../auth/verifyJwt.js');
    setDbClientFactoryForTests(fakeDbClient);
    setTokenVerifierForTests(async (t) => (TOKENS[t] ? { id: TOKENS[t] } : null));
    const { registerSocketHandlers } = await import('./socketHandlers.js');
    ({ CLIENT_EVENTS: EVENTS } = await import('@dailyways/collab-protocol'));

    httpServer = createServer();
    const io = new Server(httpServer);
    registerSocketHandlers(io);
    await new Promise((r) => httpServer.listen(0, '127.0.0.1', r));
    url = `http://127.0.0.1:${httpServer.address().port}`;
  });

  after(async () => {
    for (const s of sockets) s.disconnect();
    await new Promise((r) => httpServer.close(r));
    await db.close();
  });

  it('duas pessoas no mesmo board: todo mundo recebe as ops na mesma ordem e o banco fica com a última', async () => {
    const a = await connect('tok-u1');
    const b = await connect('tok-u2');
    assert.equal((await emit(a, EVENTS.JOIN, { boardId: BOARD })).ok, true);
    assert.equal((await emit(b, EVENTS.JOIN, { boardId: BOARD })).ok, true);
    const seenA = collect(a, 'op:applied');
    const seenB = collect(b, 'op:applied');

    // Cores trocadas quase ao mesmo tempo pelas duas pessoas.
    await Promise.all([
      emit(a, EVENTS.OP, op(updateCard({ color: '#ff0000' }))),
      emit(b, EVENTS.OP, op(updateCard({ color: '#0000ff' }))),
    ]);
    await waitFor(() => seenA.length === 2 && seenB.length === 2);
    const order = (list) => list.map((p) => p.op.value.payload.updates.color).join(',');
    assert.equal(order(seenA), order(seenB), 'as duas abas viram a mesma ordem');
    const last = seenA[1].op.value.payload.updates.color;
    await waitFor(async () => (await cardRow()).color === last);
  });

  it('edição com listId velho (card movido por outra pessoa) não se perde', async () => {
    const a = await connect('tok-u1');
    const b = await connect('tok-u2');
    await emit(a, EVENTS.JOIN, { boardId: BOARD });
    await emit(b, EVENTS.JOIN, { boardId: BOARD });
    await emit(a, EVENTS.OP, op({ type: 'MOVE_CARD', payload: { boardId: BOARD, cardId: C1, sourceListId: L1, destListId: L2, destIndex: 0 } }));
    // b ainda acha que o card está em L1
    const r = await emit(b, EVENTS.OP, op(updateCard({ title: 'Renomeado por B' }, L1)));
    assert.equal(r.ok, true);
    await waitFor(async () => {
      const row = await cardRow();
      return row.list_id === L2 && row.title === 'Renomeado por B';
    });
  });

  it('edição de fora da sala (Importante/Diário) chega para quem está dentro e é gravada', async () => {
    const inside = await connect('tok-u2');
    await emit(inside, EVENTS.JOIN, { boardId: BOARD });
    const seen = collect(inside, 'op:applied');
    const outside = await connect('tok-u1');
    const r = await emit(outside, EVENTS.BOARD_OP, { boardId: BOARD, op: op(updateCard({ priority: 'high' })) });
    assert.equal(r.ok, true);
    await waitFor(() => seen.some((p) => p.op.value.payload.updates?.priority === 'high'));
    await waitFor(async () => (await cardRow()).priority === 'high');
  });

  it('op enviada logo antes de sair do board não é descartada (fila única join/leave/ops)', async () => {
    const a = await connect('tok-u1');
    await emit(a, EVENTS.JOIN, { boardId: BOARD });
    a.emit(EVENTS.OP, op(updateCard({ description: 'antes do leave' })));
    await emit(a, EVENTS.LEAVE, { boardId: BOARD });
    await waitFor(async () => (await cardRow()).description === 'antes do leave');
  });

  it('reenvio com o mesmo opId (reconexão) não aplica duas vezes', async () => {
    const a = await connect('tok-u1');
    await emit(a, EVENTS.JOIN, { boardId: BOARD });
    const same = op({ type: 'ADD_CARD', payload: { boardId: BOARD, listId: L1, title: 'Uma vez só' } });
    await emit(a, EVENTS.OP, same);
    const again = await emit(a, EVENTS.OP, same);
    assert.equal(again.duplicate, true);
    await waitFor(async () => (await db.query(`SELECT count(*)::int AS n FROM public.cards WHERE title = 'Uma vez só'`)).rows[0].n === 1);
  });

  it('segurança: op na sala do board A mirando o board B é recusada', async () => {
    const b = await connect('tok-u2');
    await emit(b, EVENTS.JOIN, { boardId: BOARD });
    const r = await emit(b, EVENTS.OP, op({ type: 'UPDATE_BOARD', payload: { id: OTHER_BOARD, updates: { title: 'hack' } } }));
    assert.equal(r.ok, false);
    const t = (await db.query('SELECT title FROM public.boards WHERE id = $1', [OTHER_BOARD])).rows[0].title;
    assert.equal(t, 'Outro');
  });

  it('segurança: UPDATE_BOARD não troca listas/id (só título, emoji e cor)', async () => {
    const b = await connect('tok-u2');
    await emit(b, EVENTS.JOIN, { boardId: BOARD });
    await emit(b, EVENTS.OP, op({ type: 'UPDATE_BOARD', payload: { id: BOARD, updates: { lists: [], id: OTHER_BOARD, title: 'Novo título' } } }));
    await waitFor(async () => (await db.query('SELECT title FROM public.boards WHERE id = $1', [BOARD])).rows[0].title === 'Novo título');
    const n = (await db.query('SELECT count(*)::int AS n FROM public.lists WHERE board_id = $1', [BOARD])).rows[0].n;
    assert.equal(n, 2);
  });

  it('segurança: quem não tem acesso não entra nem edita de fora', async () => {
    const c = await connect('tok-u3');
    assert.equal((await emit(c, EVENTS.JOIN, { boardId: BOARD })).ok, false);
    const r = await emit(c, EVENTS.BOARD_OP, { boardId: BOARD, op: op(updateCard({ title: 'invasor' })) });
    assert.equal(r.ok, false);
    assert.notEqual((await cardRow()).title, 'invasor');
  });

  it('token renovado sem reconectar; token de outra pessoa é recusado', async () => {
    const a = await connect('tok-u1');
    assert.equal((await emit(a, EVENTS.AUTH_REFRESH, { token: 'tok-u2' })).ok, false);
    assert.equal((await emit(a, EVENTS.AUTH_REFRESH, { token: 'tok-u1-new' })).ok, true);
    assert.equal(a.connected, true);
  });

  it('token do editor expirou: o flush usa o de outro editor da sala em vez de travar', async () => {
    const a = await connect('tok-u1');
    const b = await connect('tok-u2');
    await emit(b, EVENTS.JOIN, { boardId: BOARD });
    await emit(a, EVENTS.JOIN, { boardId: BOARD });
    expired.add('tok-u1');
    try {
      await emit(a, EVENTS.OP, op(updateCard({ title: 'salvo mesmo assim' })));
      await waitFor(async () => (await cardRow()).title === 'salvo mesmo assim', 5000);
    } finally {
      expired.delete('tok-u1');
    }
  });
});
