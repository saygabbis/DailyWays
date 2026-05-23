/** Deslocamento do canto superior-esquerdo ao criar nós (centro do clique → posição do nó). */
export const NODE_CREATE_OFFSETS = {
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
    column: [100, 100],
    table: [140, 60],
};

export function getNodeCreateOffset(type) {
    return NODE_CREATE_OFFSETS[type] ?? [50, 50];
}
