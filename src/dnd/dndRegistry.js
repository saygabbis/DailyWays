import { createContext, useContext, useEffect, useRef } from 'react';

/**
 * Registro de "donos" de arraste. Um DndContext só no app inteiro (um card do board precisa poder
 * cair na sidebar); cada área (board, sidebar…) registra os tipos que entende:
 *
 *   useDndHandlers({
 *     card: { onStart, onOver, onEnd, onCancel, renderOverlay },   // quem é ARRASTADO
 *     zone: { accepts(activeData), onDrop(activeData, overData) },  // onde dá para SOLTAR
 *   })
 *
 * No fim do arraste: se o alvo tem `accepts` e aceita, ele trata o drop (e a origem só limpa a
 * prévia com onCancel); senão a origem trata com onEnd.
 */
export const DndRegistryContext = createContext(null);

export function useDndRegistry() {
  return useContext(DndRegistryContext);
}

/** Registra handlers por tipo enquanto o componente estiver montado (sempre a versão mais recente). */
export function useDndHandlers(handlersByKind) {
  const registry = useDndRegistry();
  const latest = useRef(handlersByKind);
  useEffect(() => {
    latest.current = handlersByKind;
  });
  useEffect(() => {
    if (!registry) return undefined;
    const kinds = Object.keys(latest.current || {});
    const proxies = Object.fromEntries(kinds.map((kind) => [kind, {
      onStart: (...a) => latest.current?.[kind]?.onStart?.(...a),
      onOver: (...a) => latest.current?.[kind]?.onOver?.(...a),
      onMove: (...a) => latest.current?.[kind]?.onMove?.(...a),
      onEnd: (...a) => latest.current?.[kind]?.onEnd?.(...a),
      onCancel: (...a) => latest.current?.[kind]?.onCancel?.(...a),
      renderOverlay: (...a) => latest.current?.[kind]?.renderOverlay?.(...a) ?? null,
      announce: (...a) => latest.current?.[kind]?.announce?.(...a) ?? null,
      accepts: latest.current?.[kind]?.accepts ? (...a) => Boolean(latest.current?.[kind]?.accepts?.(...a)) : null,
      onDrop: (...a) => latest.current?.[kind]?.onDrop?.(...a),
    }]));
    return registry.register(proxies);
    // Os tipos registrados não mudam durante a vida do componente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registry]);
}

/** Tipo do item arrastado/alvo (data.current.kind), seguro para null. */
export const dndKind = (entity) => entity?.data?.current?.kind ?? null;
