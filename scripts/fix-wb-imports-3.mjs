import fs from 'fs';
import path from 'path';

const WB = path.join(process.cwd(), 'src/components/Whiteboard');

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (/\.jsx?$/.test(ent.name)) files.push(p);
  }
  return files;
}

function depthToSrc(rel) {
  const parts = rel.split('/');
  parts.pop(); // file
  return parts.length; // folders under Whiteboard
}

let n = 0;
for (const file of walk(WB)) {
  const rel = path.relative(WB, file).replace(/\\/g, '/');
  const depth = depthToSrc(rel);
  if (depth <= 1) continue; // canvas/, panels/ use ../../../
  if (depth === 2) continue;

  let s = fs.readFileSync(file, 'utf8');
  const o = s;
  const prefix = '../'.repeat(depth + 1); // +1 for Whiteboard itself
  s = s.replace(/from '\.\.\/\.\.\/\.\.\//g, `from '${prefix}`);
  if (s !== o) {
    fs.writeFileSync(file, s);
    n++;
    console.log(rel, '->', prefix);
  }
}
console.log('fixed', n);
