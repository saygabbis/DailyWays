import React, { useMemo, useState, useCallback } from 'react';
import { useWhiteboardStore } from '../../stores/whiteboardStore';
import { useCollabPatch } from '../../collab/whiteboard/CollabOpsContext.jsx';
import { useAuth } from '../../context/AuthContext';
import { buildLayerTree, layerDisplayName, renamePatchForNode, canNestInside } from './layerTreeUtils';
import { CONTAINER_NODE_TYPES } from './viewportUtils';
import { patchNodeWithHistory } from './whiteboardHistory';
import {
    nestNodeInContainer,
    unnestNodeToRoot,
    reorderLayerSibling,
    duplicateLayerSubtree,
    deleteLayerSubtree,
    createFrameLayer,
    clonePageNodes,
    deletePageNodes,
} from './layersPanelOps';
import {
    Plus,
    Copy,
    Trash2,
    Pencil,
    GripVertical,
    Layout,
    Square,
    Type,
    StickyNote,
    Link2,
    ListTodo,
    Columns,
    Table2,
    MessageSquare,
    Image,
    FileText,
    PencilLine,
    FileStack,
    FolderOpen,
    Ungroup,
    ChevronRight,
    ChevronDown,
} from 'lucide-react';

const TYPE_ICONS = {
    shape: Square,
    text: Type,
    sticky_note: StickyNote,
    frame: Layout,
    link: Link2,
    todo_list: ListTodo,
    column: Columns,
    table: Table2,
    comment: MessageSquare,
    image: Image,
    file_card: FileText,
    drawing: PencilLine,
    draw: PencilLine,
};

function LayerRow({
    node,
    depth,
    selectedSet,
    onSelect,
    childNodes,
    dragId,
    dropHint,
    onDragStart,
    onDragOver,
    onDragEnd,
    onDrop,
    renamingId,
    renameValue,
    onRenameChange,
    onRenameCommit,
    onRenameCancel,
    onStartRename,
    onDuplicate,
    onDelete,
    onUngroup,
}) {
    const Icon = TYPE_ICONS[node.type] || Square;
    const isSelected = selectedSet.has(node.id);
    const [open, setOpen] = useState(true);
    const hasKids = childNodes?.length > 0;
    const isContainer = CONTAINER_NODE_TYPES.includes(node.type);
    const isRenaming = renamingId === node.id;
    const isDragOver = dropHint?.targetId === node.id;
    const dropMode = isDragOver ? dropHint.mode : null;

    return (
        <div className="space-layer-branch">
            <div
                className={[
                    'space-layer-row',
                    isSelected ? 'selected' : '',
                    dragId === node.id ? 'dragging' : '',
                    isDragOver && dropMode === 'inside' ? 'drop-inside' : '',
                    isDragOver && dropMode === 'before' ? 'drop-before' : '',
                    isDragOver && dropMode === 'after' ? 'drop-after' : '',
                ].filter(Boolean).join(' ')}
                style={{ paddingLeft: 4 + depth * 14 }}
                draggable={!isRenaming}
                onDragStart={(e) => onDragStart(e, node.id)}
                onDragOver={(e) => onDragOver(e, node.id, isContainer)}
                onDragEnd={onDragEnd}
                onDrop={(e) => onDrop(e, node.id)}
                onClick={(e) => {
                    if (isRenaming) return;
                    e.stopPropagation();
                    onSelect(node.id, e.shiftKey);
                }}
            >
                <span className="space-layer-grip" title="Arrastar">
                    <GripVertical size={14} />
                </span>
                {hasKids ? (
                    <button
                        type="button"
                        className="space-layer-expand"
                        onClick={(e) => {
                            e.stopPropagation();
                            setOpen((v) => !v);
                        }}
                    >
                        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                ) : (
                    <span className="space-layer-expand-spacer" />
                )}
                <span className={`space-layer-icon ${isContainer ? 'is-container' : ''}`}>
                    <Icon size={15} strokeWidth={1.75} />
                </span>
                {isRenaming ? (
                    <input
                        className="space-layer-rename-input"
                        value={renameValue}
                        onChange={(e) => onRenameChange(e.target.value)}
                        onBlur={onRenameCommit}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                onRenameCommit();
                            }
                            if (e.key === 'Escape') onRenameCancel();
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <span className="space-layer-name" onDoubleClick={() => onStartRename(node.id)}>
                        {layerDisplayName(node)}
                    </span>
                )}
                <div className="space-layer-actions">
                    {node.parentId && (
                        <button
                            type="button"
                            title="Sair do grupo"
                            onClick={(e) => {
                                e.stopPropagation();
                                onUngroup(node.id);
                            }}
                        >
                            <Ungroup size={14} />
                        </button>
                    )}
                    <button
                        type="button"
                        title="Renomear"
                        onClick={(e) => {
                            e.stopPropagation();
                            onStartRename(node.id);
                        }}
                    >
                        <Pencil size={14} />
                    </button>
                    <button
                        type="button"
                        title="Duplicar"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDuplicate(node.id);
                        }}
                    >
                        <Copy size={14} />
                    </button>
                    <button
                        type="button"
                        title="Excluir"
                        className="danger"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(node.id);
                        }}
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
            {hasKids && open && (
                <div>
                    {childNodes.map((child) => (
                        <LayerRow
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            selectedSet={selectedSet}
                            onSelect={onSelect}
                            childNodes={child._children}
                            dragId={dragId}
                            dropHint={dropHint}
                            onDragStart={onDragStart}
                            onDragOver={onDragOver}
                            onDragEnd={onDragEnd}
                            onDrop={onDrop}
                            renamingId={renamingId}
                            renameValue={renameValue}
                            onRenameChange={onRenameChange}
                            onRenameCommit={onRenameCommit}
                            onRenameCancel={onRenameCancel}
                            onStartRename={onStartRename}
                            onDuplicate={onDuplicate}
                            onDelete={onDelete}
                            onUngroup={onUngroup}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function LayersTab({ spaceId, spaceTitle }) {
    const { user } = useAuth();
    const {
        nodes,
        selectedNodeIds,
        setSelection,
        spacePages,
        activePageId,
        setActivePageId,
        addSpacePage,
        renameSpacePage,
        deleteSpacePage,
        duplicateSpacePage,
        addNode,
    } = useWhiteboardStore();
    const { collabPatchNode, collabPatchNodes, collabCreateNode, collabDeleteNodes, connected: collabConnected } =
        useCollabPatch();

    const [renamingId, setRenamingId] = useState(null);
    const [renamingPageId, setRenamingPageId] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [pageRenameValue, setPageRenameValue] = useState('');
    const [dragId, setDragId] = useState(null);
    const [dropHint, setDropHint] = useState(null);

    const selectedSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);
    const activePage = spacePages.find((p) => p.id === activePageId) ?? spacePages[0];

    const tree = useMemo(() => buildLayerTree(nodes, activePageId), [nodes, activePageId]);

    const layerCtx = useCallback(
        () => ({
            spaceId,
            userId: user?.id,
            collabCreateNode,
            collabConnected,
            addNode,
            store: useWhiteboardStore,
        }),
        [spaceId, user?.id, collabCreateNode, collabConnected, addNode]
    );

    const handleSelect = (id, shiftKey) => {
        if (shiftKey) {
            const next = selectedSet.has(id)
                ? selectedNodeIds.filter((x) => x !== id)
                : [...selectedNodeIds, id];
            setSelection(next);
        } else {
            setSelection([id]);
        }
    };

    const handleStartRename = (id) => {
        const node = nodes.find((n) => n.id === id);
        if (!node) return;
        setRenamingId(id);
        setRenameValue(layerDisplayName(node));
    };

    const handleRenameCommit = () => {
        if (!renamingId) return;
        const node = nodes.find((n) => n.id === renamingId);
        const patch = node ? renamePatchForNode(node, renameValue) : null;
        if (patch) patchNodeWithHistory(useWhiteboardStore, collabPatchNode, renamingId, patch);
        setRenamingId(null);
        setRenameValue('');
    };

    const handlePageRenameCommit = () => {
        if (!renamingPageId) return;
        renameSpacePage(renamingPageId, pageRenameValue);
        setRenamingPageId(null);
        setPageRenameValue('');
    };

    const handleDragStart = (e, id) => {
        setDragId(id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
    };

    const handleDragOver = (e, targetId, isContainer) => {
        e.preventDefault();
        if (!dragId || dragId === targetId) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const h = rect.height;
        let mode = 'after';
        if (isContainer && y > h * 0.28 && y < h * 0.72) {
            mode = canNestInside(dragId, targetId, nodes) ? 'inside' : 'after';
        } else if (y < h * 0.35) {
            mode = 'before';
        } else {
            mode = 'after';
        }
        setDropHint({ targetId, mode });
    };

    const handleDragEnd = () => {
        setDragId(null);
        setDropHint(null);
    };

    const handleDrop = (e, targetId) => {
        e.preventDefault();
        const dragged = dragId || e.dataTransfer.getData('text/plain');
        const hint = dropHint;
        setDragId(null);
        setDropHint(null);
        if (!dragged || !hint || hint.targetId !== targetId) return;

        if (hint.mode === 'inside') {
            nestNodeInContainer(useWhiteboardStore, collabPatchNode, dragged, targetId);
        } else {
            reorderLayerSibling(useWhiteboardStore, collabPatchNodes, dragged, targetId, hint.mode);
        }
    };

    const handleDropOnCanvas = (e) => {
        e.preventDefault();
        const dragged = dragId;
        setDragId(null);
        setDropHint(null);
        if (dragged) unnestNodeToRoot(useWhiteboardStore, collabPatchNode, dragged);
    };

    const handleAddPage = () => addSpacePage();

    const handleDuplicatePage = async () => {
        const fromId = activePageId;
        duplicateSpacePage(fromId);
        const toId = useWhiteboardStore.getState().activePageId;
        await clonePageNodes(useWhiteboardStore, fromId, toId, layerCtx());
    };

    const handleDeletePage = async () => {
        if (spacePages.length <= 1) return;
        if (!window.confirm('Excluir esta página e todos os elementos nela?')) return;
        await deletePageNodes(useWhiteboardStore, collabDeleteNodes, activePageId);
        deleteSpacePage(activePageId);
    };

    return (
        <div className="space-layers-tab">
            <div className="space-inspector-section space-layers-pages">
                <div className="space-layers-toolbar">
                    <span className="space-inspector-section-title">
                        <FileStack size={12} />
                        Páginas
                    </span>
                    <div className="space-layers-toolbar-actions">
                        <button type="button" title="Nova página" onClick={handleAddPage}>
                            <Plus size={15} />
                        </button>
                        <button type="button" title="Duplicar página" onClick={handleDuplicatePage}>
                            <Copy size={15} />
                        </button>
                        <button
                            type="button"
                            title="Renomear página"
                            onClick={() => {
                                setRenamingPageId(activePageId);
                                setPageRenameValue(activePage?.name ?? '');
                            }}
                        >
                            <Pencil size={15} />
                        </button>
                        <button
                            type="button"
                            title="Excluir página"
                            className="danger"
                            disabled={spacePages.length <= 1}
                            onClick={handleDeletePage}
                        >
                            <Trash2 size={15} />
                        </button>
                    </div>
                </div>
                <div className="space-layers-page-list">
                    {spacePages.map((page) => (
                        <button
                            key={page.id}
                            type="button"
                            className={`space-layers-page-item ${page.id === activePageId ? 'active' : ''}`}
                            onClick={() => setActivePageId(page.id)}
                        >
                            <FolderOpen size={14} />
                            {renamingPageId === page.id ? (
                                <input
                                    className="space-layer-rename-input"
                                    value={pageRenameValue}
                                    onChange={(e) => setPageRenameValue(e.target.value)}
                                    onBlur={handlePageRenameCommit}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handlePageRenameCommit();
                                        if (e.key === 'Escape') setRenamingPageId(null);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    autoFocus
                                />
                            ) : (
                                <span>{page.name}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-inspector-section space-layers-elements">
                <div className="space-layers-toolbar">
                    <span className="space-inspector-section-title">
                        <Layout size={12} />
                        Camadas
                    </span>
                    <div className="space-layers-toolbar-actions">
                        <button
                            type="button"
                            title="Novo frame (grupo)"
                            onClick={() => createFrameLayer(useWhiteboardStore, { collabCreateNode }, layerCtx())}
                        >
                            <Layout size={15} />
                            <Plus size={12} className="space-layers-plus-badge" />
                        </button>
                        {selectedNodeIds.length > 0 && (
                            <>
                                <button
                                    type="button"
                                    title="Duplicar seleção"
                                    onClick={() =>
                                        duplicateLayerSubtree(
                                            useWhiteboardStore,
                                            { collabCreateNode },
                                            selectedNodeIds[0],
                                            layerCtx()
                                        )
                                    }
                                >
                                    <Copy size={15} />
                                </button>
                                <button
                                    type="button"
                                    title="Excluir seleção"
                                    className="danger"
                                    onClick={() =>
                                        deleteLayerSubtree(useWhiteboardStore, collabDeleteNodes, selectedNodeIds)
                                    }
                                >
                                    <Trash2 size={15} />
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div
                    className="space-layers-drop-root"
                    onDragOver={(e) => {
                        e.preventDefault();
                        if (dragId) setDropHint({ targetId: '__root__', mode: 'root' });
                    }}
                    onDrop={handleDropOnCanvas}
                >
                    <span className="space-layers-drop-root-label">Canvas — solte aqui para sair do grupo</span>
                </div>

                <div className="space-inspector-layer-list">
                    {tree.length === 0 ? (
                        <p className="space-inspector-empty">Nenhum elemento nesta página</p>
                    ) : (
                        tree.map((node) => (
                            <LayerRow
                                key={node.id}
                                node={node}
                                depth={0}
                                selectedSet={selectedSet}
                                onSelect={handleSelect}
                                childNodes={node._children}
                                dragId={dragId}
                                dropHint={dropHint}
                                onDragStart={handleDragStart}
                                onDragOver={handleDragOver}
                                onDragEnd={handleDragEnd}
                                onDrop={handleDrop}
                                renamingId={renamingId}
                                renameValue={renameValue}
                                onRenameChange={setRenameValue}
                                onRenameCommit={handleRenameCommit}
                                onRenameCancel={() => setRenamingId(null)}
                                onStartRename={handleStartRename}
                                onDuplicate={(id) =>
                                    duplicateLayerSubtree(useWhiteboardStore, { collabCreateNode }, id, layerCtx())
                                }
                                onDelete={(id) => deleteLayerSubtree(useWhiteboardStore, collabDeleteNodes, [id])}
                                onUngroup={(id) => unnestNodeToRoot(useWhiteboardStore, collabPatchNode, id)}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
