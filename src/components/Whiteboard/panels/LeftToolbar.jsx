import React, { useRef, useState, useEffect } from 'react';
import { useWhiteboardStore } from '../../../stores/whiteboardStore';
import {
    MousePointer2,
    StickyNote,
    Type,
    Square,
    Layout,
    Link2,
    ListTodo,
    Table2,
    ArrowRightLeft,
    MessageSquare,
    MoreHorizontal,
    Pencil,
    ImagePlus,
    FileUp,
    Undo2,
    Redo2,
} from 'lucide-react';
import CommentsPanel from '../panels/CommentsPanel';
import DraggablePanel from '../panels/DraggablePanel';
import { useCollabPatch } from '../../../collab/whiteboard/ops/CollabOpsContext.jsx';
import { performUndo, performRedo } from '../core/history/undoController';
import { getToolMenuConfig } from './toolbar/toolMenuRegistry.js';
import ToolbarToolGroup from './toolbar/ToolbarToolGroup.jsx';
import ToolbarToolButton from './toolbar/ToolbarToolButton.jsx';
import ToolbarToolMenu from './toolbar/ToolbarToolMenu.jsx';
import '../styles/LeftToolbar.css';

const TOOLS = [
    { id: 'select', icon: MousePointer2, label: 'Selecionar' },
    { id: 'sticky_note', icon: StickyNote, label: 'Nota' },
    { id: 'text', icon: Type, label: 'Texto' },
    { id: 'shape', icon: Square, label: 'Forma' },
    { id: 'frame', icon: Layout, label: 'Frame' },
    { id: 'link', icon: Link2, label: 'Link' },
    { id: 'todo_list', icon: ListTodo, label: 'To-do' },
    { id: 'table', icon: Table2, label: 'Tabela' },
    { id: 'connector', icon: ArrowRightLeft, label: 'Conector' },
    { id: 'comment', icon: MessageSquare, label: 'Comentário' },
];

export default function LeftToolbar({ onUploadImage, onUploadFile, registerOpenImagePicker, registerOpenFilePicker, variant }) {
    const imageInputRef = useRef(null);
    const fileInputRef = useRef(null);
    const moreRef = useRef(null);
    const [showMore, setShowMore] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const {
        activeTool,
        setActiveTool,
        toolVariants,
        setToolVariant,
        canUndo,
        canRedo,
    } = useWhiteboardStore();
    const { collabPatchNode, collabCreateNode, collabDeleteNodes } = useCollabPatch();

    const collabApi = { collabPatchNode, collabCreateNode, collabDeleteNodes };

    const handleUndo = () => performUndo(collabApi);

    const handleRedo = () => performRedo(collabApi);

    const handleToolClick = (toolId) => {
        if (toolId === 'comment') {
            setShowComments((v) => !v);
            return;
        }
        setActiveTool(toolId);
    };

    const handleImageClick = () => {
        try {
            if (imageInputRef.current) {
                imageInputRef.current.value = '';
                imageInputRef.current.click();
            }
        } catch (err) {
            console.warn('[LeftToolbar] image input click failed', err);
        }
    };
    const handleFileClick = () => {
        try {
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
                fileInputRef.current.click();
            }
        } catch (err) {
            console.warn('[LeftToolbar] file input click failed', err);
        }
    };

    useEffect(() => {
        if (registerOpenImagePicker) registerOpenImagePicker(handleImageClick);
        if (registerOpenFilePicker) registerOpenFilePicker(handleFileClick);
    }, [registerOpenImagePicker, registerOpenFilePicker]);

    return (
        <div className={`left-toolbar ${variant === 'bottom' ? 'left-toolbar-bottom' : ''}`}>
            <div className="left-toolbar-tools">
                {TOOLS.map((tool) => {
                    const menuConfig = getToolMenuConfig(tool.id);
                    if (menuConfig) {
                        return (
                            <ToolbarToolGroup
                                key={tool.id}
                                tool={tool}
                                config={menuConfig}
                                activeTool={activeTool}
                                activeVariant={toolVariants?.[tool.id] ?? menuConfig.defaultVariant}
                                onSelectTool={handleToolClick}
                                onSelectVariant={setToolVariant}
                            />
                        );
                    }
                    return (
                        <ToolbarToolButton
                            key={tool.id}
                            tool={tool}
                            active={activeTool === tool.id}
                            onClick={handleToolClick}
                        />
                    );
                })}
                <div ref={moreRef} className="left-toolbar-more">
                    <button
                        type="button"
                        className="left-toolbar-btn"
                        onClick={() => setShowMore((v) => !v)}
                        title="Mais"
                        aria-expanded={showMore}
                    >
                        <MoreHorizontal size={20} />
                    </button>
                    <ToolbarToolMenu
                        open={showMore}
                        onClose={() => setShowMore(false)}
                        orientation="horizontal"
                        anchorRef={moreRef}
                        triggerRef={moreRef}
                    >
                        <button type="button" onClick={() => { setShowMore(false); setActiveTool('draw'); }}>
                            <Pencil size={16} /> Desenho
                        </button>
                    </ToolbarToolMenu>
                </div>
                <button type="button" className="left-toolbar-btn" onClick={handleImageClick} title="Enviar imagem">
                    <ImagePlus size={20} />
                </button>
                <button type="button" className="left-toolbar-btn" onClick={handleFileClick} title="Enviar arquivo">
                    <FileUp size={20} />
                </button>
            </div>
            <div className="left-toolbar-actions">
                <button
                    type="button"
                    className="left-toolbar-btn"
                    onClick={handleUndo}
                    disabled={!canUndo()}
                    title="Desfazer"
                >
                    <Undo2 size={20} />
                </button>
                <button
                    type="button"
                    className="left-toolbar-btn"
                    onClick={handleRedo}
                    disabled={!canRedo()}
                    title="Refazer"
                >
                    <Redo2 size={20} />
                </button>
            </div>
            <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && onUploadImage) onUploadImage(file);
                    e.target.value = '';
                }}
            />
            <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && onUploadFile) onUploadFile(file);
                    e.target.value = '';
                }}
            />
            {showComments && (
                <DraggablePanel id="comments-panel" defaultPosition={{ left: 320, top: 80 }}>
                    <CommentsPanel onClose={() => setShowComments(false)} />
                </DraggablePanel>
            )}
        </div>
    );
}
