/**
 * Supabase falso para o teste ponta a ponta: PostgREST (subconjunto), Auth com JWT de verdade
 * (JWKS, para o collab-server validar como em produção) e o banco num PGlite em memória.
 * Nada sai da máquina. Uso: e2e/run.mjs.
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');

export const PASSWORD = 'senha-e2e';

const FILTER_OPS = {
  eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'LIKE', ilike: 'ILIKE',
};

const ident = (name) => `"${String(name).replace(/"/g, '')}"`;

function parseList(raw) {
  // in.(a,b,"c d")
  const inner = raw.replace(/^\(/, '').replace(/\)$/, '');
  if (!inner) return [];
  return inner.split(',').map((v) => v.trim().replace(/^"(.*)"$/, '$1'));
}

export async function startFakeSupabase({ port = 54321, users = [], seed = '' } = {}) {
  const db = new PGlite();
  await db.exec(readFileSync(join(here, 'schema.sql'), 'utf8'));
  for (const m of ['20261024190000_upsert_board_full_diff_and_idor', '20261024200000_upsert_board_full_day_category']) {
    await db.exec(readFileSync(join(repo, `supabase/migrations/${m}.sql`), 'utf8'));
  }
  for (const u of users) {
    await db.query('INSERT INTO public.profiles (id, username, name) VALUES ($1, $2, $3)', [u.id, u.username, u.name]);
  }
  if (seed) await db.exec(seed);

  const columnsCache = new Map();
  const columnsOf = async (table) => {
    if (!columnsCache.has(table)) {
      const { rows } = await db.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
        [table],
      );
      columnsCache.set(table, new Map(rows.map((r) => [r.column_name, r.data_type])));
    }
    return columnsCache.get(table);
  };
  const pkOf = async (table) => {
    const { rows } = await db.query(
      `SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
       WHERE i.indrelid = ('public.' || $1)::regclass AND i.indisprimary`,
      [table],
    );
    return rows.map((r) => r.attname);
  };

  const { privateKey, publicKey } = await generateKeyPair('ES256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'e2e', alg: 'ES256', use: 'sig' };
  const issuer = `http://127.0.0.1:${port}/auth/v1`;
  const refreshTokens = new Map();
  const userById = new Map(users.map((u) => [u.id, u]));

  const userJson = (u) => ({
    id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email,
    email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: { provider: 'email' },
    user_metadata: { name: u.name, username: u.username }, created_at: '2026-01-01T00:00:00Z',
  });

  async function sessionFor(u, ttlSeconds = 3600) {
    const now = Math.floor(Date.now() / 1000);
    const access = await new SignJWT({ email: u.email, role: 'authenticated', aud: 'authenticated' })
      .setProtectedHeader({ alg: 'ES256', kid: 'e2e' })
      .setSubject(u.id).setIssuer(issuer).setIssuedAt(now).setExpirationTime(now + ttlSeconds)
      .sign(privateKey);
    const refresh = randomUUID();
    refreshTokens.set(refresh, u.id);
    return {
      access_token: access, token_type: 'bearer', expires_in: ttlSeconds, expires_at: now + ttlSeconds,
      refresh_token: refresh, user: userJson(u),
    };
  }

  const userFromAuth = (req) => {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
      return userById.get(payload.sub) ?? null;
    } catch {
      return null;
    }
  };

  async function buildWhere(table, params, startIndex = 1) {
    const cols = await columnsOf(table);
    const where = [];
    const values = [];
    for (const [key, raw] of params) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(key)) continue;
      if (!cols.has(key)) continue; // or=, embutidos… (ignorados: o teste não depende deles)
      const m = /^(not\.)?(\w+)\.(.*)$/s.exec(raw);
      if (!m) continue;
      const [, not, op, val] = m;
      const col = ident(key);
      if (op === 'in') {
        values.push(parseList(val));
        where.push(`${not ? 'NOT ' : ''}${col}::text = ANY($${startIndex + values.length - 1}::text[])`);
      } else if (op === 'is') {
        where.push(`${col} IS ${not ? 'NOT ' : ''}${val === 'null' ? 'NULL' : val.toUpperCase()}`);
      } else if (FILTER_OPS[op]) {
        values.push(val.replace(/\*/g, '%'));
        where.push(`${not ? 'NOT ' : ''}${col}::text ${FILTER_OPS[op]} $${startIndex + values.length - 1}`);
      }
    }
    return { sql: where.length ? ` WHERE ${where.join(' AND ')}` : '', values };
  }

  const toDbValue = (v, type) => {
    if (v === undefined) return null;
    if (type === 'jsonb' || type === 'json') return v === null ? null : JSON.stringify(v);
    return v;
  };

  async function handleRest(req, res, url, body) {
    const parts = url.pathname.replace(/^\/rest\/v1\//, '').split('/');
    const user = userFromAuth(req);

    if (parts[0] === 'rpc') {
      const fn = parts[1];
      if (fn === 'upsert_board_full') {
        await db.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: user?.id ?? '' })]);
        const { rows } = await db.query('SELECT public.upsert_board_full($1::jsonb) AS r', [JSON.stringify(body?.p_board ?? {})]);
        return send(res, 200, rows[0].r);
      }
      if (fn === 'board_inventory_for_current_user') return send(res, 200, [{ owned_boards: 0, membership_rows: 0 }]);
      if (/^(count_)/.test(fn)) return send(res, 200, 0);
      if (/^(list_|search_|get_|board_)/.test(fn)) return send(res, 200, []);
      return send(res, 200, null);
    }

    const table = parts[0];
    const cols = await columnsOf(table);
    if (!cols.size) return send(res, 200, []);
    const params = [...url.searchParams.entries()];
    const wantsObject = (req.headers.accept || '').includes('vnd.pgrst.object');
    const prefer = req.headers.prefer || '';
    const returning = prefer.includes('return=representation');

    if (req.method === 'GET' || req.method === 'HEAD') {
      const { sql, values } = await buildWhere(table, params);
      let order = '';
      const orderParam = url.searchParams.get('order');
      if (orderParam) {
        order = ' ORDER BY ' + orderParam.split(',').map((o) => {
          const [c, dir] = o.split('.');
          return cols.has(c) ? `${ident(c)} ${dir === 'desc' ? 'DESC' : 'ASC'}` : null;
        }).filter(Boolean).join(', ');
        if (order === ' ORDER BY ') order = '';
      }
      const limit = url.searchParams.get('limit');
      const { rows } = await db.query(`SELECT * FROM public.${ident(table)}${sql}${order}${limit ? ` LIMIT ${Number(limit)}` : ''}`, values);
      res.setHeader('Content-Range', `0-${Math.max(rows.length - 1, 0)}/${rows.length}`);
      if (wantsObject) {
        if (rows.length !== 1) return send(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `${rows.length} rows` });
        return send(res, 200, rows[0]);
      }
      return send(res, 200, rows);
    }

    if (req.method === 'POST') {
      const items = Array.isArray(body) ? body : [body];
      const upsert = prefer.includes('resolution=merge-duplicates');
      const ignore = prefer.includes('resolution=ignore-duplicates');
      const conflict = url.searchParams.get('on_conflict')?.split(',') ?? await pkOf(table);
      const out = [];
      for (const item of items) {
        const keys = Object.keys(item).filter((k) => cols.has(k));
        const values = keys.map((k) => toDbValue(item[k], cols.get(k)));
        const ph = keys.map((_, i) => `$${i + 1}`);
        let sql = `INSERT INTO public.${ident(table)} (${keys.map(ident).join(', ')}) VALUES (${ph.join(', ')})`;
        if ((upsert || ignore) && conflict.length) {
          const upd = keys.filter((k) => !conflict.includes(k));
          sql += ` ON CONFLICT (${conflict.map(ident).join(', ')}) ` + (ignore || !upd.length
            ? 'DO NOTHING'
            : `DO UPDATE SET ${upd.map((k) => `${ident(k)} = EXCLUDED.${ident(k)}`).join(', ')}`);
        }
        try {
          const { rows } = await db.query(`${sql} RETURNING *`, values);
          out.push(...rows);
        } catch (err) {
          const code = /duplicate key/.test(err.message) ? '23505' : '42000';
          return send(res, 409, { code, message: err.message });
        }
      }
      if (!returning) return send(res, 201, null);
      return send(res, 201, wantsObject ? out[0] ?? null : out);
    }

    if (req.method === 'PATCH') {
      const keys = Object.keys(body || {}).filter((k) => cols.has(k));
      if (!keys.length) return send(res, returning ? 200 : 204, returning ? [] : null);
      const values = keys.map((k) => toDbValue(body[k], cols.get(k)));
      const set = keys.map((k, i) => `${ident(k)} = $${i + 1}`).join(', ');
      const { sql, values: wv } = await buildWhere(table, params, values.length + 1);
      const { rows } = await db.query(`UPDATE public.${ident(table)} SET ${set}${sql} RETURNING *`, [...values, ...wv]);
      if (!returning) return send(res, 204, null);
      return send(res, 200, wantsObject ? rows[0] ?? null : rows);
    }

    if (req.method === 'DELETE') {
      const { sql, values } = await buildWhere(table, params);
      const { rows } = await db.query(`DELETE FROM public.${ident(table)}${sql} RETURNING *`, values);
      if (!returning) return send(res, 204, null);
      return send(res, 200, rows);
    }
    return send(res, 405, { message: 'method' });
  }

  async function handleAuth(req, res, url, body) {
    const path = url.pathname.replace(/^\/auth\/v1/, '');
    if (path === '/.well-known/jwks.json') return send(res, 200, { keys: [jwk] });
    if (path === '/token') {
      const grant = url.searchParams.get('grant_type');
      if (grant === 'password') {
        const u = users.find((x) => x.email === body?.email);
        if (!u || body?.password !== PASSWORD) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials' });
        return send(res, 200, await sessionFor(u));
      }
      if (grant === 'refresh_token') {
        const uid = refreshTokens.get(body?.refresh_token);
        if (!uid) return send(res, 400, { error: 'invalid_grant', code: 'refresh_token_not_found' });
        return send(res, 200, await sessionFor(userById.get(uid)));
      }
    }
    if (path === '/user') {
      const u = userFromAuth(req);
      return u ? send(res, 200, userJson(u)) : send(res, 401, { message: 'invalid JWT' });
    }
    if (path === '/logout') return send(res, 204, null);
    return send(res, 404, { message: 'not found' });
  }

  // ── Storage mínimo em memória (upload multipart, URL assinada, download) ──
  const objects = new Map(); // "bucket/path" → { buf, type }
  const CRLF2 = Buffer.from('\r\n\r\n');
  function parseMultipartFile(buf, contentType) {
    const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
    if (!m) return { buf, type: contentType || 'application/octet-stream' };
    const boundary = Buffer.from(`--${m[1] || m[2]}`);
    let start = buf.indexOf(boundary);
    while (start !== -1) {
      const next = buf.indexOf(boundary, start + boundary.length);
      if (next === -1) break;
      const part = buf.subarray(start + boundary.length + 2, next - 2);
      const sep = part.indexOf(CRLF2);
      const headers = part.subarray(0, sep).toString();
      if (/filename=/i.test(headers) || /name=""/.test(headers)) {
        const type = (/content-type:\s*([^\r\n]+)/i.exec(headers) || [])[1] || 'application/octet-stream';
        return { buf: Buffer.from(part.subarray(sep + 4)), type };
      }
      start = next;
    }
    return { buf, type: contentType };
  }
  async function handleStorage(req, res, url, raw, body) {
    const rest = decodeURIComponent(url.pathname.replace(/^\/storage\/v1\//, ''));
    const signBatch = /^object\/sign\/([^/]+)$/.exec(rest);
    if (signBatch && req.method === 'POST') {
      const bucket = signBatch[1];
      return send(res, 200, (body?.paths || []).map((p) => (objects.has(`${bucket}/${p}`)
        ? { path: p, signedURL: `/object/sign/${bucket}/${p}?token=e2e`, error: null }
        : { path: p, signedURL: null, error: 'Either the object does not exist or you do not have access to it' })));
    }
    const sign = /^object\/sign\/([^/]+)\/(.+)$/.exec(rest);
    if (sign) {
      const key = `${sign[1]}/${sign[2]}`;
      const obj = objects.get(key);
      if (!obj) return send(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
      if (req.method === 'POST') return send(res, 200, { signedURL: `/object/sign/${key}?token=e2e` });
      res.statusCode = 200;
      res.setHeader('Content-Type', obj.type);
      return res.end(obj.buf);
    }
    const put = /^object\/([^/]+)\/(.+)$/.exec(rest);
    if (put && (req.method === 'POST' || req.method === 'PUT')) {
      const key = `${put[1]}/${put[2]}`;
      if (objects.has(key) && req.method === 'POST' && req.headers['x-upsert'] !== 'true') {
        return send(res, 400, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' });
      }
      objects.set(key, parseMultipartFile(raw, req.headers['content-type']));
      return send(res, 200, { Key: key, Id: key });
    }
    return send(res, 404, { message: 'not found' });
  }

  function send(res, status, payload) {
    res.statusCode = status;
    if (payload === null || status === 204) return res.end();
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(payload));
  }

  const stats = { rest: 0, rpcUpsert: 0 };
  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,HEAD,OPTIONS');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range');
    if (req.method === 'OPTIONS') return send(res, 204, null);
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks);
    let body = null;
    try { body = raw.length && !String(req.headers['content-type'] || '').startsWith('multipart/') ? JSON.parse(raw.toString()) : null; } catch { body = null; }
    try {
      if (url.pathname.startsWith('/rest/v1/')) {
        stats.rest += 1;
        if (url.pathname === '/rest/v1/rpc/upsert_board_full') stats.rpcUpsert += 1;
        return await handleRest(req, res, url, body);
      }
      if (url.pathname.startsWith('/auth/v1/')) return await handleAuth(req, res, url, body);
      if (url.pathname.startsWith('/storage/v1/')) return await handleStorage(req, res, url, raw, body);
      return send(res, 404, { message: 'not found' });
    } catch (err) {
      return send(res, 500, { message: err.message });
    }
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));

  return {
    db,
    stats,
    objects,
    url: `http://127.0.0.1:${port}`,
    sessionFor: (id) => sessionFor(userById.get(id)),
    close: async () => {
      await new Promise((r) => server.close(r));
      await db.close();
    },
  };
}
