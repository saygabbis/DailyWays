/**
 * Conexão rápida: com um único nó selecionado, um "+" em cada lado cria um nó parecido naquela
 * direção, já ligado por um conector (estilo mapa mental). Some durante edição de texto e com
 * outras ferramentas ativas.
 */
import { Plus } from 'lucide-react';
import { useWhiteboardDocumentStore } from '../../../../stores/whiteboardDocumentStore';
import { useWhiteboardSelectionStore } from '../../../../stores/whiteboardSelectionStore';
import { useElementRect } from '../../../../hooks/useElementRect';
import { buildNodesById, nodeToWorld } from '../../core/nodeGeometry';

const OFFSET_PX = 22;
const DIRS = [
    { id: 'right', label: 'à direita', dx: 1, dy: 0 },
    { id: 'down', label: 'abaixo', dx: 0, dy: 1 },
    { id: 'left', label: 'à esquerda', dx: -1, dy: 0 },
    { id: 'up', label: 'acima', dx: 0, dy: -1 },
];
/** Tipos que fazem sentido "continuar" (o resto cria uma nota). */
export const QUICK_CONNECT_TYPES = new Set(['sticky_note', 'shape', 'text', 'todo_list', 'link', 'image', 'frame', 'table', 'drawing', 'file_card']);

export default function QuickConnectHandles({ viewport, containerRef, onQuickConnect }) {
    const selectedNodeIds = useWhiteboardSelectionStore((s) => s.selectedNodeIds);
    const editingNodeId = useWhiteboardSelectionStore((s) => s.editingNodeId);
    const activeTool = useWhiteboardSelectionStore((s) => s.activeTool);
    const nodes = useWhiteboardDocumentStore((s) => s.nodes);
    const rect = useElementRect(containerRef);

    if (selectedNodeIds.length !== 1 || editingNodeId || activeTool !== 'select' || !rect?.width) return null;
    const node = nodes.find((n) => n.id === selectedNodeIds[0]);
    if (!node || !QUICK_CONNECT_TYPES.has(node.type) || node.locked) return null;
    const { x, y } = nodeToWorld(node, buildNodesById(nodes));
    const z = viewport.zoom || 1;
    const left = rect.width / 2 + viewport.panX + x * z;
    const top = rect.height / 2 + viewport.panY + y * z;
    const w = (node.width || 0) * z;
    const h = (node.height || 0) * z;
    // nó minúsculo na tela: os botões cobririam o próprio nó
    if (w < 24 && h < 24) return null;

    return (
        <div className="whiteboard-quick-connect" aria-label="Conexão rápida">
            {DIRS.map((d) => {
                const cx = left + w / 2 + d.dx * (w / 2 + OFFSET_PX);
                const cy = top + h / 2 + d.dy * (h / 2 + OFFSET_PX);
                return (
                    <button
                        key={d.id}
                        type="button"
                        className="whiteboard-quick-connect-btn"
                        style={{ left: cx, top: cy }}
                        title={`Novo item conectado ${d.label}`}
                        aria-label={`Novo item conectado ${d.label}`}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                            e.stopPropagation();
                            onQuickConnect(node, d);
                        }}
                    >
                        <Plus size={14} strokeWidth={2.5} aria-hidden />
                    </button>
                );
            })}
        </div>
    );
}
