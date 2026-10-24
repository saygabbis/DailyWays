/** Raio/forma da borda usada no preview de arrasto de um nó (elipse, cantos da aparência ou borderRadius). */
import { getCornerRadii } from '../../shared/appearanceStyle';

export const DEFAULT_NODE_RADIUS = {
    sticky_note: 8,
    comment: 8,
    todo_list: 8,
    link: 8,
    file_card: 8,
    frame: 8,
};

export function dragPreviewBorderFromNode(node) {
    if (!node) return {};
    if (node.type === 'shape' && node.data?.shape === 'ellipse') {
        return { radiusShape: 'ellipse' };
    }
    const appearance = node.style?.appearance;
    if (appearance) {
        const corners = getCornerRadii(appearance);
        return { cornerRadii: corners };
    }
    if (typeof node.style?.borderRadius === 'number') {
        return { borderRadius: node.style.borderRadius };
    }
    const fallback = DEFAULT_NODE_RADIUS[node.type];
    if (typeof fallback === 'number') return { borderRadius: fallback };
    return {};
}
