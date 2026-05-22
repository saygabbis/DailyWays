import { useBoardCollabContext } from '../ops/BoardCollabContext.jsx';
import './BoardCollabStatusBanner.css';

export default function BoardCollabStatusBanner() {
  const ctx = useBoardCollabContext();
  if (!ctx?.collabEnabled || !ctx.activeBoardId) return null;
  if (ctx.connected) return null;

  return (
    <div className="board-collab-status-banner" role="status">
      Reconectando ao servidor de colaboração…
    </div>
  );
}
