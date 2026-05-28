import { useWhiteboardStore } from '../../../../stores/whiteboardStore';
import { resolveNodeClickSelection } from '../../core/layers/whiteboardGroupOps';

const DRAG_THRESHOLD_PX = 4;

function applyNodeClickSelection(nodeId, modifiers) {
    const state = useWhiteboardStore.getState();
    const { selection, drill, isolate } = resolveNodeClickSelection(
        nodeId,
        state.nodes,
        state.selectedNodeIds,
        modifiers,
        state.groupDrill
    );
    state.setSelectionWithDrill(selection, drill, isolate);
}

/**
 * Atualiza seleção no pointerdown. Se o nó já está selecionado (sem Shift/Ctrl),
 * adia até o pointerup — assim arrastar não re-dispara drill/grupo.
 * @returns {() => void} cleanup dos listeners (chamar no unmount ou antes de novo down)
 */
export function pointerDownUpdateSelection(e, nodeId) {
    const modifiers = {
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey || e.metaKey,
    };
    const { selectedNodeIds } = useWhiteboardStore.getState();
    const preserveForDrag =
        !modifiers.shiftKey &&
        !modifiers.ctrlKey &&
        selectedNodeIds.includes(nodeId);

    if (!preserveForDrag) {
        applyNodeClickSelection(nodeId, modifiers);
        return () => {};
    }

    const startX = e.clientX;
    const startY = e.clientY;
    let dragStarted = false;

    const onMove = (ev) => {
        if (dragStarted) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (dx * dx + dy * dy >= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
            dragStarted = true;
        }
    };

    const onUp = () => {
        if (!dragStarted) {
            applyNodeClickSelection(nodeId, modifiers);
        }
        cleanup();
    };

    const cleanup = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return cleanup;
}
