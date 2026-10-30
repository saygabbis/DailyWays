import { useEffect, useState } from 'react';
import { useBoardCollabContext } from '../ops/useBoardCollab';
import './BoardCollabStatusBanner.css';

/** Quedas curtas (deploy, troca de rede) passam despercebidas: as edições ficam na tela e sobem ao voltar. */
const SHOW_AFTER_MS = 4000;

export default function BoardCollabStatusBanner() {
  const ctx = useBoardCollabContext();
  const offline = Boolean(ctx?.collabEnabled && ctx.activeBoardId && !ctx.connected);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!offline) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- esconde assim que reconecta
      setVisible(false);
      return undefined;
    }
    const t = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => clearTimeout(t);
  }, [offline]);

  if (!offline || !visible) return null;

  return (
    <div className="board-collab-status-banner" role="status">
      <span className="board-collab-status-dot" aria-hidden="true" />
      Sem conexão — suas alterações ficam salvas aqui e sincronizam quando voltar
    </div>
  );
}
