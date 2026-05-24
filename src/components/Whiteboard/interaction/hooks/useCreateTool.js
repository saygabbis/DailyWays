/** Constantes e helpers de criação por arrasto (lógica principal em CanvasShell). */
export const CREATION_DRAG_TOOLS = new Set([
    'sticky_note',
    'text',
    'shape',
    'frame',
    'todo_list',
    'table',
    'comment',
    'link',
    'draw',
]);

export const CREATE_DRAG_THRESHOLD_PX = 4;
export const CREATE_MIN_SIZE = 0;

export function creationToolToNodeType(tool) {
    if (tool === 'draw') return 'drawing';
    if (tool === 'file') return 'file_card';
    return tool;
}

export function isDragCreationTool(tool, nodeTypesAllowed) {
    return CREATION_DRAG_TOOLS.has(tool) && nodeTypesAllowed.includes(creationToolToNodeType(tool));
}
