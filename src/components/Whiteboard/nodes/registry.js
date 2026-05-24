import StickyNoteNode from './types/StickyNoteNode.jsx';
import TextNode from './types/TextNode.jsx';
import ShapeNode from './types/ShapeNode.jsx';
import FrameNode from './types/FrameNode.jsx';
import ImageNode from './types/ImageNode.jsx';
import ConnectorNode from './types/ConnectorNode.jsx';
import CommentNode from './types/CommentNode.jsx';
import LinkCardNode from './types/LinkCardNode.jsx';
import TodoListNode from './types/TodoListNode.jsx';
import FileCardNode from './types/FileCardNode.jsx';
import DrawingNode from './types/DrawingNode.jsx';
import TableNode from './types/TableNode.jsx';

/** Tabela única: tipo → componente, ferramenta, metadados. */
export const NODE_REGISTRY = [
    { type: 'sticky_note', component: StickyNoteNode, tool: 'sticky_note', label: 'Nota' },
    { type: 'text', component: TextNode, tool: 'text', label: 'Texto' },
    { type: 'shape', component: ShapeNode, tool: 'shape', label: 'Forma' },
    { type: 'frame', component: FrameNode, tool: 'frame', label: 'Frame' },
    { type: 'image', component: ImageNode, tool: 'image', label: 'Imagem' },
    { type: 'connector', component: ConnectorNode, tool: 'connector', label: 'Conector' },
    { type: 'comment', component: CommentNode, tool: 'comment', label: 'Comentário' },
    { type: 'link', component: LinkCardNode, tool: 'link', label: 'Link' },
    { type: 'todo_list', component: TodoListNode, tool: 'todo_list', label: 'To-do' },
    { type: 'file_card', component: FileCardNode, tool: 'file', label: 'Ficheiro' },
    { type: 'draw', component: DrawingNode, tool: 'draw', label: 'Desenho' },
    { type: 'table', component: TableNode, tool: 'table', label: 'Tabela' },
];

export const NODE_COMPONENTS = Object.fromEntries(
    NODE_REGISTRY.map((e) => [e.type, e.component])
);

export const TOOL_ITEMS = NODE_REGISTRY.filter((e) => e.tool).map((e) => ({
    id: e.tool,
    label: e.label,
    type: e.type,
}));
