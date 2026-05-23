/** Estado de resize/rotação — refs partilhados com CanvasShell. */
import { useRef, useState } from 'react';

export function useResizeRotateState() {
    const resizeActiveRef = useRef(false);
    const [resizeState, setResizeState] = useState(null);
    const [rotateState, setRotateState] = useState(null);
    return { resizeActiveRef, resizeState, setResizeState, rotateState, setRotateState };
}
