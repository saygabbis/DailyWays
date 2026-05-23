/** Estado de arrasto de nós — refs partilhados com CanvasShell. */
import { useRef } from 'react';

export function useNodeDragRefs() {
    return {
        nodeDragRef: useRef(null),
    };
}
