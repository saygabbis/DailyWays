import React, { useEffect, useState, useMemo } from 'react';
import { useWhiteboardStore } from '../../../stores/whiteboardStore';
import { useCollabPatch } from '../../../collab/whiteboard/CollabOpsContext.jsx';
import { alignSelectedNodes } from '../core/align/whiteboardAlign';
import { nodeToWorld, buildNodesById } from '../core/ops/whiteboardNodeOps';
import { patchNodeWithHistory } from '../core/history/whiteboardHistory';
import LayersTab from './LayersTab';
import {
    PanelRightClose,
    PanelRightOpen,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignStartVertical,
    AlignCenterVertical,
    AlignEndVertical,
    AlignJustify,
    Focus,
    Layers,
    SlidersHorizontal,
} from 'lucide-react';
import {
    FONT_FAMILY_OPTIONS,
    FONT_WEIGHT_OPTIONS,
    TEXT_ALIGN_OPTIONS,
    TEXT_STYLE_NODE_TYPES,
    getTextStyleFromNode,
} from '../shared/textStyle';
import { APPEARANCE_NODE_TYPES } from '../shared/appearanceStyle';
import ShapeVariantSection from './inspector/ShapeVariantSection.jsx';
import AppearanceOpacitySection from './inspector/AppearanceOpacitySection.jsx';
import AppearanceCornersSection from './inspector/AppearanceCornersSection.jsx';
import AppearanceFillSection from './inspector/AppearanceFillSection.jsx';
import AppearanceStrokeSection from './inspector/AppearanceStrokeSection.jsx';
import InspectorSection from './inspector/InspectorSection.jsx';
import '../styles/InspectorPanel.css';

const TYPE_LABELS = {
    shape: 'Forma',
    text: 'Texto',
    sticky_note: 'Nota',
    frame: 'Frame',
    link: 'Link',
    todo_list: 'To-do',
    table: 'Tabela',
    comment: 'Comentário',
    image: 'Imagem',
    file_card: 'Arquivo',
    drawing: 'Desenho',
    draw: 'Desenho',
};

function NumField({ label, value, onChange, onCommit, min }) {
    return (
        <label className="space-inspector-field">
            <span>{label}</span>
            <input
                type="number"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onCommit}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        onCommit();
                    }
                }}
                min={min}
            />
        </label>
    );
}

const TEXT_ALIGN_ICONS = {
    left: AlignLeft,
    center: AlignCenter,
    right: AlignRight,
    justify: AlignJustify,
};

function TextDesignSection({ node }) {
    const { collabPatchNode } = useCollabPatch();
    const style = getTextStyleFromNode(node);

    const patchStyle = (partial) => {
        patchNodeWithHistory(useWhiteboardStore, collabPatchNode, node.id, {
            style: { ...(node.style || {}), ...partial },
        });
    };

    return (
        <InspectorSection title="Tipografia" defaultExpanded={false}>
            <label className="space-inspector-field space-inspector-field--full">
                <span>Fonte</span>
                <select
                    value={style.fontFamily}
                    onChange={(e) => patchStyle({ fontFamily: e.target.value })}
                >
                    {FONT_FAMILY_OPTIONS.map((opt) => (
                        <option key={opt.value || 'default'} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            </label>
            <div className="space-inspector-grid">
                <label className="space-inspector-field">
                    <span>Cor</span>
                    <input
                        type="color"
                        className="space-inspector-color-input"
                        value={style.color?.startsWith('#') ? style.color : '#111827'}
                        onChange={(e) => patchStyle({ color: e.target.value })}
                    />
                </label>
                <label className="space-inspector-field">
                    <span>Tamanho (px)</span>
                    <input
                        type="number"
                        min={8}
                        max={200}
                        value={style.fontSize}
                        onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!Number.isNaN(v)) patchStyle({ fontSize: v });
                        }}
                    />
                </label>
                <label className="space-inspector-field">
                    <span>Espaçamento vertical</span>
                    <input
                        type="number"
                        min={0.8}
                        max={4}
                        step={0.05}
                        value={style.lineHeight}
                        onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!Number.isNaN(v)) patchStyle({ lineHeight: v });
                        }}
                    />
                </label>
                <label className="space-inspector-field">
                    <span>Espaçamento horizontal (px)</span>
                    <input
                        type="number"
                        min={-2}
                        max={32}
                        step={0.5}
                        value={style.letterSpacing}
                        onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!Number.isNaN(v)) patchStyle({ letterSpacing: v });
                        }}
                    />
                </label>
                <label className="space-inspector-field">
                    <span>Espessura</span>
                    <select
                        value={String(style.fontWeight)}
                        onChange={(e) => patchStyle({ fontWeight: Number(e.target.value) })}
                    >
                        {FONT_WEIGHT_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            <div className="space-inspector-section-title space-inspector-section-title--sub">
                Alinhamento de texto
            </div>
            <div className="space-inspector-align-row space-inspector-text-align-row">
                {TEXT_ALIGN_OPTIONS.map((opt) => {
                    const Icon = TEXT_ALIGN_ICONS[opt.value];
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            title={opt.label}
                            className={style.textAlign === opt.value ? 'active' : ''}
                            onClick={() => patchStyle({ textAlign: opt.value })}
                        >
                            <Icon size={16} />
                        </button>
                    );
                })}
            </div>
            
        </InspectorSection>
    );
}

function DesignTab({ selectedNodes, single, nodes, spaceId }) {
    const { collabPatchNode, collabPatchNodes } = useCollabPatch();
    const [posX, setPosX] = useState('');
    const [posY, setPosY] = useState('');
    const [sizeW, setSizeW] = useState('');
    const [sizeH, setSizeH] = useState('');
    const [rotation, setRotation] = useState('');

    useEffect(() => {
        if (!single) {
            setPosX('');
            setPosY('');
            setSizeW('');
            setSizeH('');
            setRotation('');
            return;
        }
        const byId = buildNodesById(nodes);
        const world = nodeToWorld(single, byId);
        setPosX(String(Math.round(world.x)));
        setPosY(String(Math.round(world.y)));
        setSizeW(String(Math.round(single.width ?? 0)));
        setSizeH(String(Math.round(single.height ?? 0)));
        setRotation(String(Math.round(single.rotation ?? 0)));
    }, [single?.id, single?.x, single?.y, single?.width, single?.height, single?.rotation, nodes]);

    const applyPosition = () => {
        if (!single) return;
        const x = parseFloat(posX);
        const y = parseFloat(posY);
        if (Number.isNaN(x) || Number.isNaN(y)) return;
        const byId = buildNodesById(nodes);
        const patch = { x, y };
        if (single.parentId) {
            const parent = byId.get(single.parentId);
            if (parent) {
                const pw = nodeToWorld(parent, byId);
                patch.x = x - pw.x;
                patch.y = y - pw.y;
            }
        }
        patchNodeWithHistory(useWhiteboardStore, collabPatchNode, single.id, patch);
    };

    const applySize = () => {
        if (!single) return;
        const w = parseFloat(sizeW);
        const h = parseFloat(sizeH);
        const patch = {};
        if (!Number.isNaN(w) && w >= 0) patch.width = w;
        if (!Number.isNaN(h) && h >= 0) patch.height = h;
        if (Object.keys(patch).length) {
            patchNodeWithHistory(useWhiteboardStore, collabPatchNode, single.id, patch);
        }
    };

    const applyRotation = () => {
        if (!single) return;
        const r = parseFloat(rotation);
        if (!Number.isNaN(r)) {
            patchNodeWithHistory(useWhiteboardStore, collabPatchNode, single.id, { rotation: r });
        }
    };

    const align = (mode) => {
        alignSelectedNodes(useWhiteboardStore, collabPatchNodes, mode);
    };

    if (selectedNodes.length === 0) {
        return <p className="space-inspector-empty">Selecione um elemento para editar posição, tamanho e alinhamento.</p>;
    }

    return (
        <div>
            <div className="space-inspector-section">
                <div className="space-inspector-type-badge">
                    {selectedNodes.length > 1
                        ? `${selectedNodes.length} selecionados`
                        : TYPE_LABELS[single?.type] || single?.type}
                </div>
            </div>

            <InspectorSection title="Alinhar" defaultExpanded>
                <div className="space-inspector-align-row">
                    <button type="button" title="Esquerda" onClick={() => align('left')}>
                        <AlignLeft size={16} />
                    </button>
                    <button type="button" title="Centro horizontal" onClick={() => align('centerH')}>
                        <AlignCenter size={16} />
                    </button>
                    <button type="button" title="Direita" onClick={() => align('right')}>
                        <AlignRight size={16} />
                    </button>
                    <button type="button" title="Topo" onClick={() => align('top')}>
                        <AlignStartVertical size={16} />
                    </button>
                    <button type="button" title="Centro vertical" onClick={() => align('centerV')}>
                        <AlignCenterVertical size={16} />
                    </button>
                    <button type="button" title="Base" onClick={() => align('bottom')}>
                        <AlignEndVertical size={16} />
                    </button>
                    <button
                        type="button"
                        className="space-inspector-align-canvas"
                        title="Centralizar no canvas"
                        onClick={() => align('centerCanvas')}
                    >
                        <Focus size={16} />
                    </button>
                </div>
            </InspectorSection>

            {single && TEXT_STYLE_NODE_TYPES.has(single.type) && (
                <TextDesignSection node={single} />
            )}

            {single?.type === 'shape' && <ShapeVariantSection node={single} />}

            {single && APPEARANCE_NODE_TYPES.has(single.type) && (
                <>
                    <AppearanceOpacitySection node={single} />
                    <AppearanceCornersSection node={single} />
                    <AppearanceFillSection node={single} spaceId={spaceId} />
                    <AppearanceStrokeSection node={single} />
                </>
            )}

            {single && (
                <>
                    <InspectorSection title="Posição (mundo)" defaultExpanded={false}>
                        <div className="space-inspector-grid">
                            <NumField label="X" value={posX} onChange={setPosX} onCommit={applyPosition} />
                            <NumField label="Y" value={posY} onChange={setPosY} onCommit={applyPosition} />
                        </div>
                    </InspectorSection>

                    <InspectorSection title="Tamanho" defaultExpanded={false}>
                        <div className="space-inspector-grid">
                            <NumField label="L" value={sizeW} onChange={setSizeW} onCommit={applySize} min={0} />
                            <NumField label="A" value={sizeH} onChange={setSizeH} onCommit={applySize} min={0} />
                        </div>
                    </InspectorSection>

                    <InspectorSection title="Rotação" defaultExpanded={false}>
                        <NumField label="°" value={rotation} onChange={setRotation} onCommit={applyRotation} />
                    </InspectorSection>
                </>
            )}
        </div>
    );
}

export default function InspectorPanel({ spaceId, spaceTitle, open, onToggle }) {
    const { inspectorTab, setInspectorTab, nodes, selectedNodeIds } = useWhiteboardStore();

    const selectedNodes = useMemo(
        () => nodes.filter((n) => selectedNodeIds.includes(n.id)),
        [nodes, selectedNodeIds]
    );
    const single = selectedNodes.length === 1 ? selectedNodes[0] : null;

    if (!open) {
        return (
            <aside className="space-inspector space-inspector--collapsed">
                <button
                    type="button"
                    className="space-inspector-toggle"
                    onClick={onToggle}
                    title="Painel do space"
                >
                    <PanelRightOpen size={18} />
                </button>
            </aside>
        );
    }

    return (
        <aside className="space-inspector">
            <header className="space-inspector-header">
                <span className="space-inspector-title">Space</span>
                <button type="button" className="space-inspector-toggle" onClick={onToggle} title="Recolher">
                    <PanelRightClose size={18} />
                </button>
            </header>

            <div className="space-inspector-tabs" role="tablist">
                <button
                    type="button"
                    role="tab"
                    className={`space-inspector-tab ${inspectorTab === 'design' ? 'active' : ''}`}
                    onClick={() => setInspectorTab('design')}
                >
                    <SlidersHorizontal size={14} />
                    Design
                </button>
                <button
                    type="button"
                    role="tab"
                    className={`space-inspector-tab ${inspectorTab === 'layers' ? 'active' : ''}`}
                    onClick={() => setInspectorTab('layers')}
                >
                    <Layers size={14} />
                    Camadas
                </button>
            </div>

            <div className="space-inspector-body">
                {inspectorTab === 'layers' ? (
                    <LayersTab spaceId={spaceId} spaceTitle={spaceTitle} />
                ) : (
                    <DesignTab selectedNodes={selectedNodes} single={single} nodes={nodes} spaceId={spaceId} />
                )}
            </div>
        </aside>
    );
}
