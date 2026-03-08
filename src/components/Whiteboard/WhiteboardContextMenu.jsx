import React, { useEffect } from 'react';
import { StickyNote, Type, Square, Layout, ImagePlus, FileUp } from 'lucide-react';
import './WhiteboardContextMenu.css';

const COMMON_ITEMS = [
    { type: 'sticky_note', label: 'Nota', icon: StickyNote },
    { type: 'text', label: 'Texto', icon: Type },
    { type: 'shape', label: 'Forma', icon: Square },
    { type: 'frame', label: 'Frame', icon: Layout },
];

const OFFSETS = {
    sticky_note: [75, 50],
    text: [100, 20],
    shape: [50, 50],
    frame: [150, 100],
    image: [100, 75],
    file_card: [110, 40],
};

export default function WhiteboardContextMenu({ position, onClose, onCreateNode, onUploadImage, onUploadFile }) {
    useEffect(() => {
        const onGlobalClick = (e) => {
            if (!e.target?.closest?.('.whiteboard-context-menu')) onClose?.();
        };
        const onContextMenu = (e) => {
            if (!e.target?.closest?.('.whiteboard-context-menu')) onClose?.();
        };
        window.addEventListener('pointerdown', onGlobalClick);
        window.addEventListener('contextmenu', onContextMenu);
        return () => {
            window.removeEventListener('pointerdown', onGlobalClick);
            window.removeEventListener('contextmenu', onContextMenu);
        };
    }, [onClose]);

    if (!position) return null;
    const { left, top, worldX, worldY } = position;

    const handleCreate = (type) => {
        const [ox, oy] = OFFSETS[type] || [50, 50];
        onCreateNode?.(type, worldX - ox, worldY - oy);
        onClose?.();
    };

    const handleUploadImage = () => {
        onUploadImage?.();
        onClose?.();
    };

    const handleUploadFile = () => {
        onUploadFile?.();
        onClose?.();
    };

    return (
        <div
            className="whiteboard-context-menu"
            style={{ position: 'fixed', left, top, zIndex: 10001 }}
            onContextMenu={(e) => e.preventDefault()}
        >
            <div className="whiteboard-context-menu-title">Criar</div>
            {COMMON_ITEMS.map(({ type, label, icon: Icon }) => (
                <button
                    key={type}
                    type="button"
                    className="whiteboard-context-menu-item"
                    onClick={() => handleCreate(type)}
                >
                    <Icon size={16} />
                    <span>{label}</span>
                </button>
            ))}
            <div className="whiteboard-context-menu-sep" />
            <button type="button" className="whiteboard-context-menu-item" onClick={handleUploadImage}>
                <ImagePlus size={16} />
                <span>Imagem</span>
            </button>
            <button type="button" className="whiteboard-context-menu-item" onClick={handleUploadFile}>
                <FileUp size={16} />
                <span>Arquivo</span>
            </button>
        </div>
    );
}
