import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(here, rel), 'utf8');

// Postgres real (PGlite) com o espelho do schema + a migration exatamente como está no repo.
// O bloco de teste SQL é o mesmo que roda no SQL Editor: ele termina com RAISE EXCEPTION
// (rollback) e a mensagem traz o resultado de cada caso.
describe('upsert_board_full v3 (migration 20261024190000)', () => {
  let db;

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(read('schemaMirror.sql'));
    await db.exec(read('../migrations/20261024190000_upsert_board_full_diff_and_idor.sql'));
    await db.exec(read('../migrations/20261024200000_upsert_board_full_day_category.sql'));
  }, 60_000);

  it('passa em todos os casos (IDOR, pasta do dono, save sem mudança não reescreve)', async () => {
    let message = '';
    try {
      await db.exec(read('upsert_board_full.test.sql'));
    } catch (err) {
      message = String(err?.message || err);
    }
    expect(message).toMatch(/RESULTADO \(rollback\)/);
    const json = JSON.parse(message.slice(message.indexOf('[')));
    const failed = json.filter((c) => c.ok !== true);
    expect(failed).toEqual([]);
    expect(message).toMatch(/todos_ok=t/);
  });
});
