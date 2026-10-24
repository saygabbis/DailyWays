import { TOOL_VARIANT_MIME } from './toolMenuRegistry.js';

export function setToolDragData(e, toolId, variantId = null) {
    e.dataTransfer.setData('application/x-whiteboard-tool', toolId);
    if (variantId) {
        e.dataTransfer.setData(TOOL_VARIANT_MIME, JSON.stringify({ toolId, variantId }));
    }
    e.dataTransfer.effectAllowed = 'copy';
}
