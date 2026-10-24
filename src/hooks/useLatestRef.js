import { useLayoutEffect, useRef } from 'react';

/**
 * Ref que sempre aponta para o valor mais recente, sem escrever em ref durante o render.
 * Atualiza no layout effect (antes de qualquer useEffect/handler), então callbacks estáveis
 * que leem `ref.current` continuam vendo o valor atual.
 */
export function useLatestRef(value) {
    const ref = useRef(value);
    useLayoutEffect(() => {
        ref.current = value;
    });
    return ref;
}
