import React, { useRef, useState, useEffect } from 'react';
import { useWhiteboardStore } from '../../stores/whiteboardStore';
import {
    MousePointer2,
    StickyNote,
    Type,
    Square,
    Layout,
    Link2,
    ListTodo,
    Columns,
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
import CommentsPanel from './CommentsPanel';
import DraggablePanel from './DraggablePanel';
import './LeftToolbar.css';

const TOOLS = [
    { id: 'select', icon: MousePointer2, label: 'Selecionar' },
    { id: 'sticky_note', icon: StickyNote, label: 'Nota' },
    { id: 'text', icon: Type, label: 'Texto' },
    { id: 'shape', icon: Square, label: 'Forma' },
    { id: 'frame', icon: Layout, label: 'Frame' },
    { id: 'link', icon: Link2, label: 'Link' },
    { id: 'todo_list', icon: ListTodo, label: 'To-do' },
    { id: 'column', icon: Columns, label: 'Coluna' },
    { id: 'table', icon: Table2, label: 'Tabela' },
    { id: 'connector', icon: ArrowRightLeft, label: 'Conector' },
    { id: 'comment', icon: MessageSquare, label: 'Comentário' },
];

export default function LeftToolbar({ onUploadImage, onUploadFile, registerOpenImagePicker, registerOpenFilePicker, variant }) {
    const imageInputRef = useRef(null);
    const fileInputRef = useRef(null);
    const [showMore, setShowMore] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const {
        activeTool,
        setActiveTool,
        undo,
        redo,
        canUndo,
        canRedo,
    } = useWhiteboardStore();

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
                {TOOLS.map(({ id, icon: Icon, label }) => (
                    <button
                        key={id}
                        type="button"
                        className={`left-toolbar-btn ${activeTool === id ? 'active' : ''}`}
                        onClick={() => handleToolClick(id)}
                        title={label}
                        draggable={id !== 'select'}
                        onDragStart={(e) => {
                            if (id === 'select') return;
                            e.dataTransfer.setData('application/x-whiteboard-tool', id);
                            e.dataTransfer.effectAllowed = 'copy';
                        }}
                    >
                        <Icon size={20} />
                    </button>
                ))}
                <div className="left-toolbar-more">
                    <button
                        type="button"
                        className="left-toolbar-btn"
                        onClick={() => setShowMore((v) => !v)}
                        title="Mais"
                    >
                        <MoreHorizontal size={20} />
                    </button>
                    {showMore && (
                        <div className="left-toolbar-dropdown">
                            <button type="button" onClick={() => { setShowMore(false); setActiveTool('draw'); }}>
                                <Pencil size={16} /> Desenho
                            </button>
                        </div>
                    )}
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
                    onClick={undo}
                    disabled={!canUndo()}
                    title="Desfazer"
                >
                    <Undo2 size={20} />
                </button>
                <button
                    type="button"
                    className="left-toolbar-btn"
                    onClick={redo}
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
