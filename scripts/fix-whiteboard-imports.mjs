/**
 * One-off: fix relative imports after Whiteboard folder restructure.
 */
import fs from 'fs';
import path from 'path';

const WB = path.join(process.cwd(), 'src/components/Whiteboard');

const REPLACEMENTS = [
  // canvas
  [/from '\.\/ViewportController'/g, "from '../interaction/hooks/useViewport'"],
  [/from '\.\/viewportUtils'/g, "from '../interaction/viewport/viewportUtils'"],
  [/from '\.\/viewportFit'/g, "from '../interaction/viewport/viewportFit'"],
  [/from '\.\/resizeBounds'/g, "from '../interaction/transform/resizeBounds'"],
  [/from '\.\/resizeSkew'/g, "from '../interaction/transform/resizeSkew'"],
  [/from '\.\/createDragBounds'/g, "from '../interaction/transform/createDragBounds'"],
  [/from '\.\/rotatePointer'/g, "from '../interaction/transform/rotatePointer'"],
  [/from '\.\/selectionTransform'/g, "from '../interaction/transform/selectionTransform'"],
  [/from '\.\/whiteboardSnap'/g, "from '../interaction/snap/whiteboardSnap'"],
  [/from '\.\/whiteboardHistorySync'/g, "from '../core/history/whiteboardHistorySync'"],
  [/from '\.\/whiteboardHistory'/g, "from '../core/history/whiteboardHistory'"],
  [/from '\.\/whiteboardPages'/g, "from '../core/pages/whiteboardPages'"],
  [/from '\.\/inspectorLayout'/g, "from '../shared/inspectorLayout'"],
  [/from '\.\/whiteboardNodeOps'/g, "from '../core/ops/whiteboardNodeOps'"],
  [/from '\.\/whiteboardCreateOffsets'/g, "from '../core/whiteboardCreateOffsets'"],
  [/from '\.\/whiteboardGroupOps'/g, "from '../core/layers/whiteboardGroupOps'"],
  [/from '\.\/whiteboardAlign'/g, "from '../core/align/whiteboardAlign'"],
  [/from '\.\/whiteboardSelectionUtils'/g, "from '../core/selection/whiteboardSelectionUtils'"],
  [/from '\.\/layerTreeUtils'/g, "from '../core/layers/layerTreeUtils'"],
  [/from '\.\/layersPanelOps'/g, "from '../core/layers/layersPanelOps'"],
  [/from '\.\/LeftToolbar'/g, "from '../panels/LeftToolbar'"],
  [/from '\.\/DraggablePanel'/g, "from '../panels/DraggablePanel'"],
  [/from '\.\/WhiteboardContextMenu'/g, "from '../panels/WhiteboardContextMenu'"],
  [/from '\.\/InspectorPanel'/g, "from '../panels/InspectorPanel'"],
  [/from '\.\/ShortcutsHelp'/g, "from '../panels/ShortcutsHelp'"],
  [/from '\.\/CommentsPanel'/g, "from '../panels/CommentsPanel'"],
  [/from '\.\/LayersTab'/g, "from './LayersTab'"],
  [/from '\.\/CanvasEngine\.css'/g, "from './CanvasShell.css'"],
  [/from '\.\/nodes\//g, "from '../nodes/types/"],
  // interaction/hooks
  [/from '\.\/viewportUtils'/g, "from '../viewport/viewportUtils'"],
  // interaction/transform
  [/from '\.\/whiteboardNodeOps'/g, "from '../../core/ops/whiteboardNodeOps'"],
  [/from '\.\/whiteboardAlign'/g, "from '../../core/align/whiteboardAlign'"],
  [/from '\.\/whiteboardSelectionUtils'/g, "from '../../core/selection/whiteboardSelectionUtils'"],
  // interaction/snap
  [/from '\.\/whiteboardNodeOps'/g, "from '../../core/ops/whiteboardNodeOps'"],
  [/from '\.\/whiteboardAlign'/g, "from '../../core/align/whiteboardAlign'"],
  [/from '\.\/whiteboardPages'/g, "from '../../core/pages/whiteboardPages'"],
  [/from '\.\/layerTreeUtils'/g, "from '../../core/layers/layerTreeUtils'"],
  // core subdirs - same-folder siblings
  [/from '\.\/whiteboardNodeOps'/g, "from '../ops/whiteboardNodeOps'"],
  [/from '\.\/whiteboardHistory'/g, "from '../history/whiteboardHistory'"],
  [/from '\.\/whiteboardSelectionUtils'/g, "from '../selection/whiteboardSelectionUtils'"],
  [/from '\.\/whiteboardGroupOps'/g, "from '../layers/whiteboardGroupOps'"],
  [/from '\.\/layerTreeUtils'/g, "from '../layers/layerTreeUtils'"],
  [/from '\.\/viewportUtils'/g, "from '../../interaction/viewport/viewportUtils'"],
  [/from '\.\/whiteboardPages'/g, "from '../pages/whiteboardPages'"],
  // panels styles
  [/import '\.\/LeftToolbar\.css'/g, "import '../styles/LeftToolbar.css'"],
  [/import '\.\/InspectorPanel\.css'/g, "import '../styles/InspectorPanel.css'"],
  [/import '\.\/CommentsPanel\.css'/g, "import '../styles/CommentsPanel.css'"],
  [/import '\.\/DraggablePanel\.css'/g, "import '../styles/DraggablePanel.css'"],
  [/import '\.\/WhiteboardContextMenu\.css'/g, "import '../styles/WhiteboardContextMenu.css'"],
  [/import '\.\/ShortcutsHelp\.css'/g, "import '../styles/ShortcutsHelp.css'"],
  // overlay css
  [/import '\.\/SnapGuidesOverlay\.css'/g, "import './SnapGuidesOverlay.css'"],
  [/import '\.\/RulersOverlay\.css'/g, "import './RulersOverlay.css'"],
  // legacy
  [/from '\.\/AssetUploader'/g, "from '../legacy/AssetUploader'"],
  [/from '\.\/Autosave'/g, "from '../legacy/Autosave'"],
  [/from '\.\/CommentsPanel'/g, "from '../panels/CommentsPanel'"],
  // context paths from deeper folders
  [/from '\.\.\/\.\.\/context\//g, "from '../../../context/"],
  [/from '\.\.\/\.\.\/stores\//g, "from '../../../stores/"],
  [/from '\.\.\/\.\.\/services\//g, "from '../../../services/"],
  [/from '\.\.\/\.\.\/collab\//g, "from '../../../collab/"],
  [/from '\.\.\/\.\.\/utils\//g, "from '../../../utils/"],
];

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (/\.(jsx?|css)$/.test(ent.name)) files.push(p);
  }
  return files;
}

let changed = 0;
for (const file of walk(WB)) {
  let src = fs.readFileSync(file, 'utf8');
  const orig = src;
  for (const [re, rep] of REPLACEMENTS) {
    src = src.replace(re, rep);
  }
  // canvas/CanvasShell: fix context back to ../../ (script may over-correct)
  if (file.includes('canvas\\CanvasShell') || file.includes('canvas/CanvasShell')) {
    src = src.replace(/from '\.\.\/\.\.\/\.\.\/context\//g, "from '../../context/");
    src = src.replace(/from '\.\.\/\.\.\/\.\.\/stores\//g, "from '../../stores/");
    src = src.replace(/from '\.\.\/\.\.\/\.\.\/services\//g, "from '../../services/");
    src = src.replace(/from '\.\.\/\.\.\/\.\.\/collab\//g, "from '../../collab/");
    src = src.replace(/from '\.\.\/\.\.\/\.\.\/utils\//g, "from '../../utils/");
  }
  if (src !== orig) {
    fs.writeFileSync(file, src);
    changed++;
    console.log('fixed:', path.relative(process.cwd(), file));
  }
}
console.log('done,', changed, 'files');
