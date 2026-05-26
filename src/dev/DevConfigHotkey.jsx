import { useEffect, useState } from 'react';
import { useDevAccess } from './useDevAccess.js';
import DevConfigOverlay from './DevConfigOverlay.jsx';

/** Ctrl+Shift+4 — menu DEV (somente contas dev). */
export default function DevConfigHotkey() {
  const { canOpenDevMenu } = useDevAccess();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!canOpenDevMenu) {
      setOpen(false);
      return undefined;
    }

    const onKeyDown = (e) => {
      if (!e.ctrlKey || !e.shiftKey || e.altKey || e.metaKey) return;
      if (e.key !== '4' && e.code !== 'Digit4') return;
      const t = e.target;
      const tag = t?.tagName?.toLowerCase?.();
      if (tag === 'input' || tag === 'textarea' || t?.isContentEditable) return;

      e.preventDefault();
      e.stopPropagation();
      setOpen((v) => !v);
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [canOpenDevMenu]);

  if (!canOpenDevMenu) return null;

  return <DevConfigOverlay open={open} onClose={() => setOpen(false)} />;
}
