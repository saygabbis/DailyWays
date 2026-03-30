import React, { useMemo, useState, useEffect } from 'react';
import { useWhiteboardStore } from '../../stores/whiteboardStore';
import { useAuth } from '../../context/AuthContext';
import { worldToScreenWithContainer } from './viewportUtils';
import { insertNode, deleteNode as deleteNodeService } from '../../services/whiteboardService';
import { Copy, Trash2, ArrowUp, ArrowDown, Type, Palette, Shapes, Maximize2 } from 'lucide-react';
import './FloatingToolbar.css';
import { uuidv4 } from '../../utils/uuid';

const COLOR_OPTIONS = ['#fef08a', '#fecaca', '#bbf7d0', '#bfdbfe', '#e9d5ff', '#fef3c7', '#fff', '#1f2937'];

export default function FloatingToolbar({ viewport, containerRef }) {
    const { user } = useAuth();
    const [showColor, setShowColor] = useState(false);
    const [showConvert, setShowConvert] = useState(false);
    const {
        spaceId,
        selectedNodeIds,
        nodes,
        setSelection,
        deleteNodes,
        patchNode,
        addNode,
        pushHistory,
        setSuppressRealtimeUntil,
        setEditingNodeId,
    } = useWhiteboardStore();

    const selectedNodes = useMemo(
        () => nodes.filter((n) => selectedNodeIds.includes(n.id)),
        [nodes, selectedNodeIds]
    );

    const position = useMemo(() => {
        if (selectedNodes.length === 0 || !viewport) return { left: 0, top: 0 };
        const rect = containerRef?.current?.getBoundingClientRect();
        if (!rect) return { left: 0, top: 0 };
        const xs = selectedNodes.map((n) => n.x + (n.width || 0) / 2);
        const ys = selectedNodes.map((n) => n.y + (n.height || 0) / 2);
        const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
        const centerY = Math.min(...ys) - 40 / viewport.zoom;
        const screen = worldToScreenWithContainer(centerX, centerY, rect, viewport);
        return { left: screen.x, top: screen.y };
    }, [selectedNodes, viewport, containerRef?.current]);

    const handleDuplicate = async () => {
        if (!spaceId) return;
        setSuppressRealtimeUntil(2000);
        for (const node of selectedNodes) {
            const newNode = {
                ...node,
                id: uuidv4(),
                x: node.x + 20,
                y: node.y + 20,
            };
            delete newNode.createdAt;
            delete newNode.updatedAt;
            const { success } = await insertNode(spaceId, newNode, user?.id);
            if (success) {
                addNode(newNode);
                pushHistory({ type: 'node_add', payload: { node: newNode } });
            }
        }
    };

    const handleDelete = async () => {
        pushHistory({
            type: 'node_delete',
            payload: { nodes: selectedNodes.map((n) => ({ ...n })) },
        });
        setSuppressRealtimeUntil(2000);
        for (const id of selectedNodeIds) {
            await deleteNodeService(id);
        }
        deleteNodes(selectedNodeIds);
        setSelection([]);
    };

    const bringForward = () => {
        const maxZ = Math.max(0, ...nodes.map((n) => n.zIndex ?? 0));
        selectedNodes.forEach((n, i) => {
            patchNode(n.id, { zIndex: maxZ + 1 + i });
        });
    };

    const sendBackward = () => {
        const minZ = Math.min(0, ...nodes.map((n) => n.zIndex ?? 0));
        selectedNodes.forEach((n, i) => {
            patchNode(n.id, { zIndex: minZ - selectedNodes.length + i });
        });
    };

    const hasText = selectedNodes.some((n) => ['sticky_note', 'text', 'comment'].includes(n.type));
    const singleNode = selectedNodes.length === 1 ? selectedNodes[0] : null;
    const [resizeW, setResizeW] = useState('');
    const [resizeH, setResizeH] = useState('');
    useEffect(() => {
        if (singleNode) {
            setResizeW(String(Math.round(singleNode.width || 0)));
            setResizeH(String(Math.round(singleNode.height || 0)));
        } else {
            setResizeW('');
            setResizeH('');
        }
    }, [singleNode?.id, singleNode?.width, singleNode?.height]);

    const applyResize = () => {
        if (!singleNode) return;
        const w = parseInt(resizeW, 10);
        const h = parseInt(resizeH, 10);
        if (!Number.isNaN(w) && w > 0 && !Number.isNaN(h) && h > 0) {
            patchNode(singleNode.id, { width: w, height: h });
        }
    };
    const handleEditText = () => {
        if (selectedNodeIds[0]) setEditingNodeId(selectedNodeIds[0]);
    };

    const handleColor = (color) => {
        selectedNodes.forEach((n) => {
            patchNode(n.id, { style: { ...n.style, backgroundColor: color, fill: color } });
        });
        setShowColor(false);
    };

    const CONVERT_TYPES = [
        { type: 'text', label: 'Texto' },
        { type: 'sticky_note', label: 'Nota' },
        { type: 'shape', label: 'Forma' },
        { type: 'frame', label: 'Frame' },
        { type: 'link', label: 'Link' },
        { type: 'todo_list', label: 'To-do' },
        { type: 'file_card', label: 'Arquivo' },
        { type: 'drawing', label: 'Desenho' },
        { type: 'column', label: 'Coluna' },
        { type: 'table', label: 'Tabela' },
    ];
    const handleConvert = (newType) => {
        selectedNodes.forEach((n) => {
            const defaults = {
                text: { type: 'text', data: { text: n.data?.text ?? n.data?.title ?? '' }, style: {} },
                sticky_note: { type: 'sticky_note', data: { text: n.data?.text ?? '' }, style: { backgroundColor: '#fef08a' } },
                shape: { type: 'shape', data: { shape: 'rectangle' }, style: { fill: n.style?.backgroundColor || 'var(--bg-elevated)', stroke: 'var(--border-color)' } },
                frame: { type: 'frame', data: { title: n.data?.title ?? n.data?.text ?? 'Frame' }, style: {} },
                link: { type: 'link', data: { url: n.data?.url ?? '', title: n.data?.title ?? n.data?.text ?? 'Link' }, style: {} },
                todo_list: { type: 'todo_list', data: { items: [{ id: uuidv4(), text: n.data?.text ?? 'Item', done: false }] }, style: {} },
                file_card: { type: 'file_card', data: { url: n.data?.url ?? '', filename: n.data?.filename ?? 'Arquivo', size: n.data?.size ?? '' }, style: {} },
                drawing: { type: 'drawing', data: { paths: n.data?.paths ?? [] }, style: { stroke: n.style?.stroke ?? '#000' } },
                column: { type: 'column', data: { title: n.data?.title ?? n.data?.text ?? 'Coluna' }, style: {} },
                table: { type: 'table', data: { rows: n.data?.rows ?? [], cols: n.data?.cols ?? [] }, style: {} },
            };
            const d = defaults[newType];
            if (d) patchNode(n.id, d);
        });
        setShowConvert(false);
    };

    return (
        <div
            className="whiteboard-floating-toolbar"
            style={{
                position: 'fixed',
                left: position.left,
                top: position.top,
                transform: 'translate(-50%, -100%)',
                zIndex: 10000,
            }}
        >
            {hasText && (
                <button type="button" className="toolbar-btn" onClick={handleEditText} title="Editar texto">
                    <Type size={16} />
                </button>
            )}
            <div className="toolbar-dropdown-wrap">
                <button type="button" className="toolbar-btn" onClick={() => setShowColor((v) => !v)} title="Cor">
                    <Palette size={16} />
                </button>
                {showColor && (
                    <div className="toolbar-dropdown">
                        {COLOR_OPTIONS.map((c) => (
                            <button key={c} type="button" className="toolbar-color-swatch" style={{ background: c }} onClick={() => handleColor(c)} title={c} />
                        ))}
                    </div>
                )}
            </div>
            <div className="toolbar-dropdown-wrap">
                <button type="button" className="toolbar-btn" onClick={() => setShowConvert((v) => !v)} title="Converter tipo">
                    <Shapes size={16} />
                </button>
                {showConvert && (
                    <div className="toolbar-dropdown">
                        {CONVERT_TYPES.map(({ type, label }) => (
                            <button key={type} type="button" onClick={() => handleConvert(type)}>{label}</button>
                        ))}
                    </div>
                )}
            </div>
            <button type="button" className="toolbar-btn" onClick={handleDuplicate} title="Duplicar">
                <Copy size={16} />
            </button>
            <button type="button" className="toolbar-btn" onClick={handleDelete} title="Excluir">
                <Trash2 size={16} />
            </button>
            <button type="button" className="toolbar-btn" onClick={bringForward} title="Trazer à frente">
                <ArrowUp size={16} />
            </button>
            <button type="button" className="toolbar-btn" onClick={sendBackward} title="Enviar para trás">
                <ArrowDown size={16} />
            </button>
            {singleNode && (
                <div className="toolbar-resize">
                    <Maximize2 size={14} title="Redimensionar" />
                    <input
                        type="number"
                        min={20}
                        max={2000}
                        value={resizeW}
                        onChange={(e) => setResizeW(e.target.value)}
                        onBlur={applyResize}
                        onKeyDown={(e) => e.key === 'Enter' && applyResize()}
                        placeholder="L"
                        title="Largura"
                    />
                    <span>×</span>
                    <input
                        type="number"
                        min={20}
                        max={2000}
                        value={resizeH}
                        onChange={(e) => setResizeH(e.target.value)}
                        onBlur={applyResize}
                        onKeyDown={(e) => e.key === 'Enter' && applyResize()}
                        placeholder="A"
                        title="Altura"
                    />
                </div>
            )}
        </div>
    );
}
