import { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { DndRegistryContext, dndKind } from './dndRegistry.js';
import { routedCollisionDetection } from './collision.js';
import './dnd.css';

/**
 * Arrastar e soltar do app inteiro (boards, listas, cards, sidebar). Um só jeito de pegar, mover
 * e soltar:
 * - mouse: começa depois de 5 px (clique continua sendo clique);
 * - toque: segurar ~180 ms (rolar a tela continua funcionando);
 * - teclado: foco no item → Espaço/Enter pega, setas movem, Espaço solta, Esc cancela;
 * - a prévia (overlay) segue o ponteiro exatamente e "assenta" com mola ao soltar;
 * - rola sozinho perto da borda de QUALQUER contêiner (board na horizontal e lista na vertical).
 */

const MEASURING = { droppable: { strategy: MeasuringStrategy.WhileDragging } };
const AUTO_SCROLL = { threshold: { x: 0.12, y: 0.14 }, acceleration: 12, interval: 6 };

const DROP_ANIMATION = {
  duration: 280,
  easing: 'cubic-bezier(0.34, 1.36, 0.64, 1)',
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.35' } } }),
};

const SCREEN_READER = {
  draggable: 'Para mover: pressione Espaço ou Enter, use as setas e pressione Espaço de novo para soltar. Esc cancela.',
};

export default function DndProvider({ children }) {
  const handlersRef = useRef(new Set());
  const [active, setActive] = useState(null);
  const lastOverRef = useRef(null);

  const register = useCallback((handlersByKind) => {
    handlersRef.current.add(handlersByKind);
    return () => handlersRef.current.delete(handlersByKind);
  }, []);
  const registry = useMemo(() => ({ register }), [register]);

  /** Último registrado para o tipo vence (a tela atual por cima de componentes globais). */
  const handlerFor = useCallback((kind) => {
    let found = null;
    for (const set of handlersRef.current) if (set[kind]) found = set[kind];
    return found;
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const finish = () => {
    document.body.classList.remove('dnd-dragging');
    lastOverRef.current = null;
    setActive(null);
  };

  const onDragStart = useCallback((event) => {
    document.body.classList.add('dnd-dragging');
    // Pegar algo fecha menus/tooltips abertos (o menu global escuta este evento).
    window.dispatchEvent(new CustomEvent('dw-drag-start'));
    const source = handlerFor(dndKind(event.active));
    // Guarda quem desenha a prévia: o render não lê o registro (ref) diretamente.
    setActive({ data: event.active.data.current, render: source?.renderOverlay ?? null });
    source?.onStart?.(event);
  }, [handlerFor]);

  const onDragOver = useCallback((event) => {
    lastOverRef.current = event.over;
    handlerFor(dndKind(event.active))?.onOver?.(event);
  }, [handlerFor]);

  const onDragMove = useCallback((event) => {
    handlerFor(dndKind(event.active))?.onMove?.(event);
  }, [handlerFor]);

  const onDragEnd = useCallback((event) => {
    const source = handlerFor(dndKind(event.active));
    const target = event.over ? handlerFor(dndKind(event.over)) : null;
    try {
      if (target?.accepts && target.accepts(event.active.data.current, event.over.data.current)) {
        source?.onCancel?.(event);
        target.onDrop?.(event.active.data.current, event.over.data.current, event);
      } else {
        source?.onEnd?.(event);
      }
    } finally {
      finish();
    }
  }, [handlerFor]);

  const onDragCancel = useCallback((event) => {
    try {
      handlerFor(dndKind(event.active))?.onCancel?.(event);
    } finally {
      finish();
    }
  }, [handlerFor]);

  const announcements = useMemo(() => {
    const say = (type, { active: a, over }) => (
      handlerFor(dndKind(a))?.announce?.(type, a?.data?.current, over?.data?.current)
      ?? ({
        start: 'Item pego.',
        over: over ? 'Sobre um novo lugar.' : 'Fora de qualquer lugar válido.',
        end: over ? 'Item solto.' : 'Item solto fora de um lugar válido; nada mudou.',
        cancel: 'Movimento cancelado.',
      })[type]
    );
    return {
      onDragStart: (e) => say('start', e),
      onDragOver: (e) => say('over', e),
      onDragEnd: (e) => say('end', e),
      onDragCancel: (e) => say('cancel', e),
    };
  }, [handlerFor]);

  const overlay = active?.render ? active.render(active.data) : null;

  return (
    <DndRegistryContext.Provider value={registry}>
      <DndContext
        sensors={sensors}
        collisionDetection={routedCollisionDetection}
        measuring={MEASURING}
        autoScroll={AUTO_SCROLL}
        accessibility={{ announcements, screenReaderInstructions: SCREEN_READER }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        {children}
        {createPortal(
          <DragOverlay dropAnimation={DROP_ANIMATION} zIndex={400} className="dw-drag-overlay">
            {overlay ? <div className="dw-drag-lift">{overlay}</div> : null}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>
    </DndRegistryContext.Provider>
  );
}
