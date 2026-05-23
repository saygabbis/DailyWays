import { uuidv4 } from '../../../utils/uuid';
import { CREATION_TOOLS } from '../shared/constants.js';

export function getDefaultNodePayload(type, x, y) {
    const id = uuidv4();
    const base = { id, x, y, rotation: 0, scale: 1, parentId: null, zIndex: 0 };
    const defaults = {
        sticky_note: {
            type: 'sticky_note',
            width: 150,
            height: 100,
            data: { text: '' },
            style: { backgroundColor: '#fef08a', color: '#111827', fontSize: 14, lineHeight: 1.35 },
        },
        text: { type: 'text', width: 200, height: 40, data: { text: '' }, style: { fontSize: 16, color: 'var(--text-primary)' } },
        shape: { type: 'shape', width: 100, height: 100, data: { shape: 'rectangle' }, style: { fill: 'var(--bg-elevated)', stroke: 'var(--border-color)' } },
        frame: { type: 'frame', width: 300, height: 200, data: { title: 'Frame' }, style: {} },
        link: { type: 'link', width: 240, height: 80, data: { url: '', title: '' }, style: { fontSize: 14, color: 'var(--text-primary)' } },
        todo_list: { type: 'todo_list', width: 220, height: 120, data: { items: [{ id: uuidv4(), text: 'Item', done: false }] }, style: {} },
        column: { type: 'column', width: 200, height: 200, data: { title: '' }, style: {} },
        table: { type: 'table', width: 280, height: 120, data: { rows: [], cols: [] }, style: {} },
        connector: { type: 'connector', width: 0, height: 0, data: {}, style: {} },
        comment: { type: 'comment', width: 200, height: 80, data: { message: '' }, style: {} },
        draw: { type: 'draw', width: 200, height: 150, data: { paths: [] }, style: { stroke: '#000' } },
        image: { type: 'image', width: 200, height: 150, data: { url: '' }, style: {} },
        file: { type: 'file_card', width: 220, height: 80, data: { url: '', filename: '', size: '' }, style: {} },
    };
    const d = defaults[type] || defaults.sticky_note;
    return { ...base, ...d };
}

export function isCreationTool(tool) {
    return tool && tool !== 'select' && CREATION_TOOLS.includes(tool);
}
