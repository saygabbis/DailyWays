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

let n = 0;
for (const file of walk(WB)) {
  let s = fs.readFileSync(file, 'utf8');
  const o = s;
  const rel = path.relative(WB, file).replace(/\\/g, '/');

  if (rel.startsWith('core/')) {
    s = s.replace(/from '\.\.\/core\//g, "from '../");
    s = s.replace(/from '\.\.\/interaction\//g, "from '../../interaction/");
  }
  if (rel.startsWith('interaction/')) {
    s = s.replace(/from '\.\.\/core\//g, "from '../../core/");
  }
  if (rel === 'canvas/CanvasShell.jsx') {
    s = s.replace(/from '\.\/SelectionManager'/g, "from './overlays/SelectionManager'");
    s = s.replace(/from '\.\/SelectionTransformOverlay'/g, "from './overlays/SelectionTransformOverlay'");
    s = s.replace(/from '\.\/ResizeHandles'/g, "from './overlays/ResizeHandles'");
    s = s.replace(/from '\.\/RulersOverlay'/g, "from './overlays/RulersOverlay'");
    s = s.replace(/from '\.\/SnapGuidesOverlay'/g, "from './overlays/SnapGuidesOverlay'");
    s = s.replace(/'\.\/CanvasEngine\.css'/g, "'./CanvasShell.css'");
  }
  if (rel === 'canvas/NodeLayer.jsx') {
    s = s.replace(/from '\.\/ResizeHandles'/g, "from './overlays/ResizeHandles'");
  }
  if (s !== o) {
    fs.writeFileSync(file, s);
    n++;
    console.log('ok', rel);
  }
}
console.log('fixed', n);
