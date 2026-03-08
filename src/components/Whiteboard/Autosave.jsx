import React, { useEffect, useRef } from 'react';
import { useWhiteboardStore } from '../../stores/whiteboardStore';
import { updateNode } from '../../services/whiteboardService';

const DEBOUNCE_MS = 500;

export default function Autosave() {
    const timerRef = useRef(null);
    const { getDirtyNodes, clearDirty, setSuppressRealtimeUntil } = useWhiteboardStore();

    useEffect(() => {
        const flush = async () => {
            const dirty = getDirtyNodes();
            if (dirty.length === 0) return;
            setSuppressRealtimeUntil(2000);
            const ids = dirty.map((n) => n.id);
            for (const node of dirty) {
                await updateNode(node.id, {
                    x: node.x,
                    y: node.y,
                    width: node.width,
                    height: node.height,
                    rotation: node.rotation,
                    scale: node.scale,
                    data: node.data,
                    style: node.style,
                    zIndex: node.zIndex,
                });
            }
            clearDirty(ids);
        };

        const schedule = () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(flush, DEBOUNCE_MS);
        };

        const unsub = useWhiteboardStore.subscribe(() => {
            const state = useWhiteboardStore.getState();
            if (state.dirtyNodeIds?.length > 0) schedule();
        });

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            unsub();
        };
    }, [getDirtyNodes, clearDirty, setSuppressRealtimeUntil]);

    return null;
}
