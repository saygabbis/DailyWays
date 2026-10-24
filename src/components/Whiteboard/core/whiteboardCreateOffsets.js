import { getZoomAwareCreateOffset } from '../interaction/viewport/viewportCreation.js';

/** @deprecated Preferir getNodeCreateOffset(type, zoom). Mantido para zoom 1. */
const NODE_CREATE_OFFSETS = {
    sticky_note: [75, 50],
    text: [100, 20],
    shape: [50, 50],
    frame: [150, 100],
    image: [100, 75],
    file_card: [110, 40],
    comment: [100, 40],
    link: [120, 40],
    todo_list: [110, 60],
    drawing: [100, 75],
    draw: [100, 75],
    table: [140, 60],
};

/** Centro do clique → canto superior-esquerdo; escala com o zoom do canvas. */
export function getNodeCreateOffset(type, zoom = 1) {
    if (zoom != null && Number.isFinite(zoom) && zoom > 0) {
        return getZoomAwareCreateOffset(type, zoom);
    }
    return NODE_CREATE_OFFSETS[type] ?? [50, 50];
}
