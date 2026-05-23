/**
 * Makes supabase/migrations/*.sql idempotent for Supabase Preview re-runs:
 * - strips UTF-8 BOM
 * - DROP POLICY IF EXISTS before CREATE POLICY (skips policies inside DO $$)
 * - DROP TRIGGER IF EXISTS before CREATE TRIGGER
 * - DROP CONSTRAINT IF EXISTS before ADD CONSTRAINT
 */
import fs from 'fs';
import path from 'path';

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function findOnTable(lines, startIdx) {
  for (let j = startIdx; j < Math.min(startIdx + 8, lines.length); j++) {
    const m = lines[j].match(/\bON\s+((?:public|auth|storage)\.\w+)/);
    if (m) return m[1];
  }
  return null;
}

function recentHasDrop(lines, start, pattern) {
  for (let k = Math.max(0, start - 4); k < start; k++) {
    if (lines[k].includes(pattern)) return true;
  }
  return false;
}

function makeIdempotent(content) {
  const lines = content.split('\n');
  const out = [];
  let lastAlterTable = null;
  let doDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/\bDO\s*\$\$/.test(line)) doDepth++;
    if (/\bEND\s*\$\$;?\s*$/i.test(line) && doDepth > 0) doDepth--;

    const alterMatch = line.match(/^ALTER TABLE\s+((?:public|auth|storage)\.\w+)/i);
    if (alterMatch) lastAlterTable = alterMatch[1];

    const addConstMatch = line.match(/^\s*ADD CONSTRAINT\s+(\w+)/i);
    if (addConstMatch && lastAlterTable) {
      const cname = addConstMatch[1];
      const drop = `ALTER TABLE ${lastAlterTable} DROP CONSTRAINT IF EXISTS ${cname};`;
      if (!recentHasDrop(out, out.length, `DROP CONSTRAINT IF EXISTS ${cname}`)) {
        const last = out[out.length - 1];
        if (last && /^ALTER TABLE\s+/.test(last) && !/ADD CONSTRAINT/i.test(last)) {
          out.pop();
          out.push(drop);
          out.push(last);
        } else {
          out.push(drop);
        }
      }
    }

    const policyMatch = line.match(/^CREATE POLICY\s+"([^"]+)"/i);
    if (policyMatch && doDepth === 0) {
      const pname = policyMatch[1];
      const table = findOnTable(lines, i);
      if (table) {
        const drop = `DROP POLICY IF EXISTS "${pname}" ON ${table};`;
        if (!recentHasDrop(out, out.length, `DROP POLICY IF EXISTS "${pname}"`)) {
          out.push(drop);
        }
      }
    }

    const triggerMatch = line.match(/^CREATE TRIGGER\s+(\w+)/i);
    if (triggerMatch && doDepth === 0) {
      const tname = triggerMatch[1];
      const table = findOnTable(lines, i);
      if (table) {
        const drop = `DROP TRIGGER IF EXISTS ${tname} ON ${table};`;
        if (!recentHasDrop(out, out.length, `DROP TRIGGER IF EXISTS ${tname}`)) {
          out.push(drop);
        }
      }
    }

    out.push(line);
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
let changed = 0;

for (const file of files) {
  const fp = path.join(migrationsDir, file);
  const raw = fs.readFileSync(fp, 'utf8');
  const noBom = stripBom(raw);
  const next = makeIdempotent(noBom);
  if (next !== raw.replace(/^\uFEFF/, '')) {
    fs.writeFileSync(fp, next, { encoding: 'utf8' });
    console.log('updated', file);
    changed++;
  }
}

console.log(`Done. ${changed} file(s) updated.`);
