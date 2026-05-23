import fs from 'fs';
import path from 'path';

const dir = path.join(process.cwd(), 'supabase', 'migrations');
const issues = [];

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
  const lines = fs.readFileSync(path.join(dir, file), 'utf8').replace(/^\uFEFF/, '').split('\n');
  let doDepth = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/\bDO\s*\$\$/.test(line)) doDepth++;
    if (/\bEND\s*\$\$;?\s*$/i.test(line) && doDepth > 0) doDepth--;

    if (/^ALTER TABLE public\.\w+$/.test(line) && lines[i + 1]?.startsWith('ALTER TABLE public.')) {
      issues.push(`${file}:${i + 1} duplicate ALTER TABLE`);
    }

    const pm = line.match(/^CREATE POLICY "([^"]+)"/i);
    if (pm && doDepth === 0) {
      const prev = lines.slice(Math.max(0, i - 8), i).join('\n');
      if (!prev.includes(`DROP POLICY IF EXISTS "${pm[1]}"`)) {
        issues.push(`${file}:${i + 1} missing DROP for policy "${pm[1]}"`);
      }
    }

    const am = line.match(/^\s*ADD CONSTRAINT (\w+)/i);
    if (am) {
      const prev = lines.slice(Math.max(0, i - 4), i).join('\n');
      if (!prev.includes(`DROP CONSTRAINT IF EXISTS ${am[1]}`)) {
        issues.push(`${file}:${i + 1} missing DROP for constraint ${am[1]}`);
      }
    }

    const tm = line.match(/^CREATE TRIGGER (\w+)/i);
    if (tm && doDepth === 0) {
      const prev = lines.slice(Math.max(0, i - 8), i).join('\n');
      if (!prev.toLowerCase().includes(`drop trigger if exists ${tm[1].toLowerCase()}`)) {
        issues.push(`${file}:${i + 1} missing DROP for trigger ${tm[1]}`);
      }
    }
  }
  const b = fs.readFileSync(path.join(dir, file));
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) issues.push(`${file}: has UTF-8 BOM`);
}

if (issues.length) {
  console.error(issues.join('\n'));
  process.exit(1);
}
console.log('All migrations OK');
