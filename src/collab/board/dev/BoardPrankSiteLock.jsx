/**
 * DEV ONLY — bloqueio de input (hold) e lock total do site (freeze).
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useBoardDevPrankStore } from './boardDevPrank.js';
import { boardScreenPointFromContent } from '../coords/scrollContentCoords.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { resolvePresenceColor } from '../../../utils/presenceColor.js';
import './BoardPrankSiteLock.css';

const POINTER_PATH = 'M2 2 L2 17 L7 12 L10.5 21 L13 19.5 L9.5 11.5 L16 11.5 Z';
const BLOCK_EVENTS = [
  'pointerdown', 'pointerup', 'pointermove', 'click', 'dblclick',
  'contextmenu', 'mousedown', 'mouseup', 'mousemove', 'wheel',
  'keydown', 'keyup', 'keypress', 'touchstart', 'touchmove', 'touchend',
];

function blockEvent(e) {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation?.();
  return false;
}

export default function BoardPrankSiteLock() {
  const frozen = useBoardDevPrankStore((s) => s.frozen);
  const held = useBoardDevPrankStore((s) => s.held);
  const puppet = useBoardDevPrankStore((s) => s.victimPuppetCursor);
  const { user, profile } = useAuth();
  const [puppetScreen, setPuppetScreen] = useState(null);
  const rafRef = useRef(0);

  const color = resolvePresenceColor({
    userId: user?.id,
    presenceColor: profile?.presence_color,
    presenceColorAuto: profile?.presence_color_auto !== false,
    photoUrl: profile?.photo_url,
  }) || '#7c3aed';

  const repaintPuppet = useCallback(() => {
    if (!held || !puppet) {
      setPuppetScreen(null);
      return;
    }
    const scroller = document.querySelector('.board-scroller');
    if (!scroller) {
      setPuppetScreen(null);
      return;
    }
    const screen = boardScreenPointFromContent(scroller, puppet.x, puppet.y);
    setPuppetScreen(screen ? { x: screen.x + 20, y: screen.y + 20 } : null);
  }, [held, puppet]);

  useEffect(() => {
    if (!held) {
      document.documentElement.classList.remove('dw-prank-held');
      setPuppetScreen(null);
      return undefined;
    }
    document.documentElement.classList.add('dw-prank-held');
    repaintPuppet();

    const onScroll = () => repaintPuppet();
    const scroller = document.querySelector('.board-scroller');
    scroller?.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    const loop = () => {
      repaintPuppet();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      document.documentElement.classList.remove('dw-prank-held');
      scroller?.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [held, puppet, repaintPuppet]);

  useEffect(() => {
    if (frozen) {
      document.documentElement.classList.add('dw-prank-frozen');
    } else {
      document.documentElement.classList.remove('dw-prank-frozen');
    }
    return () => document.documentElement.classList.remove('dw-prank-frozen');
  }, [frozen]);

  useEffect(() => {
    if (!frozen && !held) return undefined;

    const opts = { capture: true, passive: false };
    for (const type of BLOCK_EVENTS) {
      document.addEventListener(type, blockEvent, opts);
    }
    return () => {
      for (const type of BLOCK_EVENTS) {
        document.removeEventListener(type, blockEvent, opts);
      }
    };
  }, [frozen, held]);

  if (!frozen && !held) return null;

  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  if (!portalTarget) return null;

  return createPortal(
    <div
      className={[
        'board-prank-site-lock',
        frozen ? 'board-prank-site-lock--frozen' : 'board-prank-site-lock--held',
      ].join(' ')}
      aria-hidden={!frozen}
    >
      {frozen && (
        <div className="board-prank-site-lock__banner">
          <p className="board-prank-site-lock__title">Mouse apagado (dev)</p>
          <p className="board-prank-site-lock__hint">Recarregue a página (F5) para voltar.</p>
        </div>
      )}
      {held && puppetScreen && (
        <svg
          className="board-prank-puppet-cursor"
          width="20"
          height="24"
          viewBox="0 0 20 24"
          style={{
            left: `${puppetScreen.x}px`,
            top: `${puppetScreen.y}px`,
          }}
          aria-hidden
        >
          <path
            d={POINTER_PATH}
            fill={color}
            stroke="#fff"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>,
    portalTarget,
  );
}
