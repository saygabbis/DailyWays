/**
 * Pentest das permissões do banco (2026-10-24) em Postgres embutido (PGlite).
 * Espelho de produção (e2e/schema.sql + supabase/tests/securityMirror.sql) e cada ataque rodando
 * como o papel `authenticated` (ou `anon`), igual ao PostgREST.
 *  - ANTES das migrations: o ataque funciona (prova que o espelho reproduz a falha).
 *  - DEPOIS (20261024190000 + 200000 + 210000): o ataque é bloqueado e o uso normal continua.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { beforeAll, describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(here, rel), 'utf8');

const O = '00000000-0000-4000-8000-00000000000a'; // dono (vítima)
const E = '00000000-0000-4000-8000-00000000000e'; // editor do board/space da vítima
const R = '00000000-0000-4000-8000-00000000000f'; // leitor do space da vítima
const S = '00000000-0000-4000-8000-000000000005'; // estranho (atacante)
const VB = '10000000-0000-4000-8000-0000000000a1'; // board da vítima
const EB = '10000000-0000-4000-8000-0000000000e1'; // board do editor (convida o estranho)
const SB = '10000000-0000-4000-8000-000000000051'; // board do estranho
const VS = '40000000-0000-4000-8000-0000000000a1'; // space da vítima
const INV = '50000000-0000-4000-8000-000000000001'; // convite EB → estranho (reader)
const INV2 = '50000000-0000-4000-8000-000000000003'; // outro convite EB → estranho
const C1 = '60000000-0000-4000-8000-000000000001'; // conversa S–E
const C2 = '60000000-0000-4000-8000-000000000002'; // conversa O–R
const M2 = '70000000-0000-4000-8000-000000000002'; // mensagem em C2
const VCARD = '30000000-0000-4000-8000-0000000000a1';
const SCARD = '30000000-0000-4000-8000-000000000051';
const COMMENT = '80000000-0000-4000-8000-000000000001';
const SC = '90000000-0000-4000-8000-000000000001'; // comentário no space
const REQ = 'a0000000-0000-4000-8000-000000000001'; // pedido de contato S → R

const SEED = `
  INSERT INTO auth.users (id, email, encrypted_password) VALUES
    ('${O}', 'dono@x.test', extensions.crypt('senha-dono', extensions.gen_salt('bf'))),
    ('${E}', 'editor@x.test', extensions.crypt('senha-editor', extensions.gen_salt('bf'))),
    ('${R}', 'leitor@x.test', extensions.crypt('senha-leitor', extensions.gen_salt('bf'))),
    ('${S}', 'estranho@x.test', extensions.crypt('senha-estranho', extensions.gen_salt('bf')));
  INSERT INTO public.profiles (id, username, name, bio) VALUES
    ('${O}', 'dono', 'Dono', 'segredo do dono'), ('${E}', 'editor', 'Editor', ''),
    ('${R}', 'leitor', 'Leitor', ''), ('${S}', 'estranho', 'Estranho', '');
  INSERT INTO public.privacy_settings (user_id) VALUES ('${O}'), ('${E}'), ('${R}'), ('${S}');
  INSERT INTO public.boards (id, owner_id, title) VALUES ('${VB}', '${O}', 'Vítima'), ('${EB}', '${E}', 'Do editor'), ('${SB}', '${S}', 'Do estranho');
  INSERT INTO public.board_members (board_id, user_id, role) VALUES
    ('${VB}', '${O}', 'owner'), ('${VB}', '${E}', 'editor'), ('${EB}', '${E}', 'owner'), ('${SB}', '${S}', 'owner');
  INSERT INTO public.lists (id, board_id, title) VALUES ('20000000-0000-4000-8000-0000000000a1', '${VB}', 'L'), ('20000000-0000-4000-8000-000000000051', '${SB}', 'L');
  INSERT INTO public.cards (id, list_id, title) VALUES ('${VCARD}', '20000000-0000-4000-8000-0000000000a1', 'c'), ('${SCARD}', '20000000-0000-4000-8000-000000000051', 'c');
  INSERT INTO public.card_comments (id, card_id, author_id, body) VALUES ('${COMMENT}', '${VCARD}', '${E}', 'comentário do editor');
  INSERT INTO public.board_invitations (id, board_id, inviter_id, invitee_email, invitee_user_id, role, status) VALUES
    ('${INV}', '${EB}', '${E}', 'estranho@x.test', '${S}', 'reader', 'pending'),
    ('${INV2}', '${EB}', '${E}', 'estranho@x.test', '${S}', 'reader', 'pending');
  INSERT INTO public.spaces (id, owner_id, title) VALUES ('${VS}', '${O}', 'Space');
  INSERT INTO public.space_members (space_id, user_id, role) VALUES ('${VS}', '${E}', 'editor'), ('${VS}', '${R}', 'reader');
  INSERT INTO public.space_comments (id, space_id, author_id, message) VALUES ('${SC}', '${VS}', '${O}', 'oi');
  INSERT INTO public.contact_requests (id, from_user_id, to_user_id, status) VALUES ('${REQ}', '${S}', '${R}', 'pending');
  INSERT INTO public.conversations (id) VALUES ('${C1}'), ('${C2}');
  INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES ('${C1}', '${S}'), ('${C1}', '${E}'), ('${C2}', '${O}'), ('${C2}', '${R}');
  INSERT INTO public.messages (id, conversation_id, sender_id, body) VALUES ('${M2}', '${C2}', '${O}', 'particular');
  INSERT INTO public.user_presence (user_id) VALUES ('${O}');
`;

async function makeDb({ fixed }) {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(read('../../e2e/schema.sql'));
  await db.exec(read('securityMirror.sql'));
  await db.exec(SEED);
  if (fixed) {
    for (const m of ['20261024190000_upsert_board_full_diff_and_idor', '20261024200000_upsert_board_full_day_category', '20261024210000_security_pentest_fixes']) {
      await db.exec(read(`../migrations/${m}.sql`));
    }
  }
  return db;
}

/** Roda SQL como usuário logado (ou anon) — igual a uma chamada via PostgREST. */
async function as(db, userId, sql, params = []) {
  await db.query(`SELECT set_config('request.jwt.claims', $1, false)`, [
    JSON.stringify(userId ? { sub: userId, role: 'authenticated', email: `${userId}@jwt` } : { role: 'anon' }),
  ]);
  await db.exec(`SET ROLE ${userId ? 'authenticated' : 'anon'}`);
  try {
    return { ok: true, rows: (await db.query(sql, params)).rows };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    await db.exec('RESET ROLE');
  }
}

const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];

/** Cada ataque devolve true se FUNCIONOU (falha de segurança). */
const ATTACKS = {
  'convidado edita o próprio convite (board e papel) e vira dono de outro board': async (db) => {
    await as(db, S, `UPDATE public.board_invitations SET board_id = '${VB}', role = 'owner' WHERE id = '${INV}'`);
    await as(db, S, `SELECT public.accept_board_invitation('${INV}')`);
    return Boolean(await one(db, `SELECT 1 FROM public.board_members WHERE board_id = '${VB}' AND user_id = '${S}'`));
  },
  'com um convite qualquer, insere a si mesmo como owner em board_members': async (db) => {
    await as(db, S, `INSERT INTO public.board_members (board_id, user_id, role) VALUES ('${EB}', '${S}', 'owner')`);
    return (await one(db, `SELECT role FROM public.board_members WHERE board_id = '${EB}' AND user_id = '${S}'`))?.role === 'owner';
  },
  'editor do board vira dono (UPDATE owner_id)': async (db) => {
    await as(db, E, `UPDATE public.boards SET owner_id = '${E}' WHERE id = '${VB}'`);
    return (await one(db, `SELECT owner_id FROM public.boards WHERE id = '${VB}'`))?.owner_id === E;
  },
  'editor do space vira dono (UPDATE owner_id)': async (db) => {
    await as(db, E, `UPDATE public.spaces SET owner_id = '${E}' WHERE id = '${VS}'`);
    return (await one(db, `SELECT owner_id FROM public.spaces WHERE id = '${VS}'`))?.owner_id === E;
  },
  'leitor do space apaga comentários': async (db) => {
    await as(db, R, `DELETE FROM public.space_comments WHERE id = '${SC}'`);
    return !(await one(db, `SELECT 1 FROM public.space_comments WHERE id = '${SC}'`));
  },
  'estranho se adiciona como "contato" e lê o perfil da vítima': async (db) => {
    await as(db, S, `INSERT INTO public.contacts (user_id, contact_user_id) VALUES ('${S}', '${O}')`);
    const r = await as(db, S, `SELECT bio FROM public.profiles WHERE id = '${O}'`);
    return r.ok && r.rows.length > 0;
  },
  'quem recebe pedido troca o remetente e cria contato com quem não pediu': async (db) => {
    await as(db, R, `UPDATE public.contact_requests SET from_user_id = '${O}', status = 'accepted' WHERE id = '${REQ}'`);
    return Boolean(await one(db, `SELECT 1 FROM public.contacts WHERE user_id = '${O}' AND contact_user_id = '${R}'`));
  },
  'mensagem própria movida para a conversa dos outros': async (db) => {
    await as(db, S, `INSERT INTO public.messages (id, conversation_id, sender_id, body) VALUES ('70000000-0000-4000-8000-000000000009', '${C1}', '${S}', 'injetada')`);
    await as(db, S, `UPDATE public.messages SET conversation_id = '${C2}' WHERE id = '70000000-0000-4000-8000-000000000009'`);
    return Boolean(await one(db, `SELECT 1 FROM public.messages WHERE conversation_id = '${C2}' AND body = 'injetada'`));
  },
  'reação em mensagem de conversa alheia': async (db) => {
    await as(db, S, `SELECT public.toggle_message_reaction('${M2}', '💀')`);
    return Boolean(await one(db, `SELECT 1 FROM public.message_reactions WHERE message_id = '${M2}' AND user_id = '${S}'`));
  },
  'lê o "visto por último" de qualquer pessoa': async (db) => {
    const r = await as(db, S, `SELECT last_seen_at FROM public.user_presence WHERE user_id = '${O}'`);
    return r.ok && r.rows.length > 0;
  },
  'busca de contatos com "%" lista todo mundo': async (db) => {
    const r = await as(db, S, `SELECT username FROM public.search_contact_targets('%', 1000)`);
    return r.ok && r.rows.length >= 3;
  },
  'sem login, descobre o e-mail pelo username': async (db) => {
    const r = await as(db, null, `SELECT public.get_email_by_username('dono') AS e`);
    return r.ok && r.rows[0]?.e === 'dono@x.test';
  },
  'autor move comentário para card de board alheio': async (db) => {
    await as(db, E, `UPDATE public.card_comments SET card_id = '${SCARD}' WHERE id = '${COMMENT}'`);
    return (await one(db, `SELECT card_id FROM public.card_comments WHERE id = '${COMMENT}'`))?.card_id === SCARD;
  },
  'editor apaga o board inteiro do dono': async (db) => {
    await as(db, E, `DELETE FROM public.boards WHERE id = '${VB}'`);
    return !(await one(db, `SELECT 1 FROM public.boards WHERE id = '${VB}'`));
  },
};

/**
 * Suspeitas da revisão que NÃO eram exploráveis: no UPDATE o Postgres exige que a linha nova
 * continue visível pela política de SELECT, e ela deixa de ser ("new row violates row-level
 * security policy"). As travas da 20261024210000 ficam como defesa extra.
 */
const NOT_EXPLOITABLE_BEFORE = new Set([
  'mensagem própria movida para a conversa dos outros',
  'autor move comentário para card de board alheio',
]);

describe('pentest do banco: espelho de produção ANTES das correções', () => {
  let db;
  beforeAll(async () => { db = await makeDb({ fixed: false }); }, 60_000);
  for (const [name, attack] of Object.entries(ATTACKS)) {
    const exploitable = !NOT_EXPLOITABLE_BEFORE.has(name);
    it(`${exploitable ? 'reproduz' : 'já era bloqueado'}: ${name}`, async () => {
      expect(await attack(db)).toBe(exploitable);
    });
  }
});

describe('pentest do banco: DEPOIS das migrations 20261024190000/200000/210000', () => {
  let db;
  beforeAll(async () => { db = await makeDb({ fixed: true }); }, 60_000);
  for (const [name, attack] of Object.entries(ATTACKS)) {
    it(`bloqueia: ${name}`, async () => {
      expect(await attack(db)).toBe(false);
    });
  }

  it('uso normal continua: recusar convite, aceitar convite (vira reader), dono muda papel', async () => {
    await db.exec(`INSERT INTO public.board_invitations (id, board_id, inviter_id, invitee_email, invitee_user_id, role, status)
      VALUES ('50000000-0000-4000-8000-000000000004', '${EB}', '${E}', 'estranho@x.test', '${S}', 'reader', 'pending')`);
    const declined = await as(db, S, `UPDATE public.board_invitations SET status = 'declined' WHERE id = '50000000-0000-4000-8000-000000000004'`);
    expect(declined.ok).toBe(true);
    expect((await one(db, `SELECT status FROM public.board_invitations WHERE id = '50000000-0000-4000-8000-000000000004'`)).status).toBe('declined');
    await db.exec(`INSERT INTO public.board_invitations (id, board_id, inviter_id, invitee_email, invitee_user_id, role, status)
      VALUES ('50000000-0000-4000-8000-000000000002', '${EB}', '${E}', 'estranho@x.test', '${S}', 'editor', 'pending')`);
    const accepted = await as(db, S, `SELECT public.accept_board_invitation('50000000-0000-4000-8000-000000000002')`);
    expect(accepted).toMatchObject({ ok: true });
    expect((await one(db, `SELECT role FROM public.board_members WHERE board_id = '${EB}' AND user_id = '${S}'`)).role).toBe('editor');
    const role = await as(db, E, `UPDATE public.board_members SET role = 'reader' WHERE board_id = '${EB}' AND user_id = '${S}'`);
    expect(role.ok).toBe(true);
    expect((await one(db, `SELECT role FROM public.board_members WHERE board_id = '${EB}' AND user_id = '${S}'`)).role).toBe('reader');
  });

  it('uso normal continua: membro sai do board; dono apaga o próprio board', async () => {
    expect((await as(db, S, `DELETE FROM public.board_members WHERE board_id = '${EB}' AND user_id = '${S}'`)).ok).toBe(true);
    expect(await one(db, `SELECT 1 FROM public.board_members WHERE board_id = '${EB}' AND user_id = '${S}'`)).toBeUndefined();
    await as(db, S, `DELETE FROM public.boards WHERE id = '${SB}'`);
    expect(await one(db, `SELECT 1 FROM public.boards WHERE id = '${SB}'`)).toBeUndefined();
  });

  it('uso normal continua: aceitar pedido de contato cria o contato; apelido pode mudar', async () => {
    expect((await as(db, R, `UPDATE public.contact_requests SET status = 'accepted', updated_at = now() WHERE id = '${REQ}'`)).ok).toBe(true);
    expect(await one(db, `SELECT 1 FROM public.contacts WHERE user_id = '${R}' AND contact_user_id = '${S}'`)).toBeTruthy();
    expect((await as(db, R, `UPDATE public.contacts SET nickname = 'amigo', pinned = true WHERE contact_user_id = '${S}'`)).ok).toBe(true);
  });

  it('login por username: só devolve o e-mail com a senha certa e trava depois de 8 erros', async () => {
    expect((await as(db, null, `SELECT public.login_email_for('dono', 'senha-dono') AS e`)).rows[0].e).toBe('dono@x.test');
    expect((await as(db, null, `SELECT public.login_email_for('dono', 'errada') AS e`)).rows[0].e).toBe(null);
    for (let i = 0; i < 8; i += 1) await as(db, null, `SELECT public.login_email_for('editor', 'chute${i}')`);
    const locked = await as(db, null, `SELECT public.login_email_for('editor', 'senha-editor') AS e`);
    expect(locked.ok).toBe(false);
    expect(locked.error).toMatch(/too_many_attempts/);
  });

  it('links só http(s); limites nos buckets', async () => {
    const bad = await as(db, E, `INSERT INTO public.card_attachments (card_id, kind, link_url, created_by) VALUES ('${VCARD}', 'link', 'javascript:alert(1)', '${E}')`);
    expect(bad.ok).toBe(false);
    const buckets = (await db.query('SELECT id, file_size_limit FROM storage.buckets ORDER BY id')).rows;
    expect(buckets.every((b) => Number(b.file_size_limit) > 0)).toBe(true);
  });
});
