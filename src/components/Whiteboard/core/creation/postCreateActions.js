import { useWhiteboardStore } from '../../../../stores/whiteboardStore';

/** Tipos que voltam à ferramenta selecionar após criar (salvo Ctrl). */
export const NODE_TYPES_REVERT_TO_SELECT = new Set([
    'frame',
    'shape',
    'text',
    'sticky_note',
    'link',
    'todo_list',
    'column',
]);

/** Tipos que entram em edição de texto logo após criar. */
export const NODE_TYPES_EDIT_ON_CREATE = new Set(['text', 'sticky_note', 'link']);

/**
 * Após criar um nó: selecionar, opcionalmente voltar ao cursor e abrir edição de texto.
 * @param {{ nodeId: string, nodeType: string, keepCreationTool?: boolean, select?: boolean }} opts
 */
export function applyPostCreateActions({
    nodeId,
    nodeType,
    keepCreationTool = false,
    select = true,
}) {
    if (!nodeId || !nodeType) return;
    const store = useWhiteboardStore.getState();
    if (select) store.setSelection([nodeId]);
    if (!keepCreationTool && NODE_TYPES_REVERT_TO_SELECT.has(nodeType)) {
        store.setActiveTool('select');
    }
    if (NODE_TYPES_EDIT_ON_CREATE.has(nodeType)) {
        store.setLastCreatedNodeId(nodeId);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                useWhiteboardStore.getState().setEditingNodeId(nodeId);
                const wrapper = document.querySelector(`[data-node-id="${nodeId}"]`);
                const field = wrapper?.querySelector('textarea, input[type="text"]');
                field?.focus?.({ preventScroll: true });
                if (field && typeof field.select === 'function') {
                    field.select();
                }
            });
        });
    }
}
