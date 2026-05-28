import React, { useEffect } from 'react';
import {
    StickyNote,
    Type,
    Square,
    Layout,
    ImagePlus,
    FileUp,
    Group,
    Ungroup,
    Copy,
    Trash2,
    BringToFront,
    SendToBack,
    Download,
    Lock,
    Unlock,
} from 'lucide-react';
import { getNodeCreateOffset } from '../core/whiteboardCreateOffsets';
import '../styles/WhiteboardContextMenu.css';

const CREATE_ITEMS = [
    { type: 'sticky_note', label: 'Nota', icon: StickyNote },
    { type: 'text', label: 'Texto', icon: Type },
    { type: 'shape', label: 'Forma', icon: Square },
    { type: 'frame', label: 'Frame', icon: Layout },
];

const COLOR_OPTIONS = ['#fef08a', '#fecaca', '#bbf7d0', '#bfdbfe', '#e9d5ff', '#fef3c7', '#fff', '#1f2937'];

export default function WhiteboardContextMenu({
    position,
    onClose,
    onCreateNode,
    onUploadImage,
    onUploadFile,
    onGroup,
    onUngroup,
    onBringToFront,
    onSendToBack,
    onDuplicate,
    onDelete,
    onColorChange,
    onDownloadImage,
    onToggleGuideLock,
    showColorPicker,
    showDownloadImage,
    guideAllLocked,
}) {
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
    const { left, top, worldX, worldY, mode = 'create', canGroup, canUngroup } = position;

    const handleCreate = (type) => {
        const [ox, oy] = getNodeCreateOffset(type);
        onCreateNode?.(type, worldX - ox, worldY - oy);
        onClose?.();
    };

    if (mode === 'guide') {
        return (
            <div
                className="whiteboard-context-menu"
                style={{ position: 'fixed', left, top, zIndex: 10001 }}
                onContextMenu={(e) => e.preventDefault()}
            >
                <div className="whiteboard-context-menu-title">Guia</div>
                <button
                    type="button"
                    className="whiteboard-context-menu-item"
                    onClick={() => {
                        onToggleGuideLock?.();
                        onClose?.();
                    }}
                >
                    {guideAllLocked ? <Unlock size={16} /> : <Lock size={16} />}
                    <span>{guideAllLocked ? 'Destravar guia' : 'Travar guia'}</span>
                </button>
                <div className="whiteboard-context-menu-sep" />
                <button
                    type="button"
                    className="whiteboard-context-menu-item whiteboard-context-menu-item--danger"
                    onClick={() => {
                        onDelete?.();
                        onClose?.();
                    }}
                >
                    <Trash2 size={16} />
                    <span>Excluir guia</span>
                </button>
            </div>
        );
    }

    if (mode === 'selection') {
        return (
            <div
                className="whiteboard-context-menu"
                style={{ position: 'fixed', left, top, zIndex: 10001 }}
                onContextMenu={(e) => e.preventDefault()}
            >
                <div className="whiteboard-context-menu-title">Seleção</div>
                {canGroup && (
                    <button
                        type="button"
                        className="whiteboard-context-menu-item"
                        onClick={() => {
                            onGroup?.();
                            onClose?.();
                        }}
                    >
                        <Group size={16} />
                        <span>Agrupar</span>
                    </button>
                )}
                {canUngroup && (
                    <button
                        type="button"
                        className="whiteboard-context-menu-item"
                        onClick={() => {
                            onUngroup?.();
                            onClose?.();
                        }}
                    >
                        <Ungroup size={16} />
                        <span>Desagrupar</span>
                    </button>
                )}
                {(canGroup || canUngroup) && <div className="whiteboard-context-menu-sep" />}
                {showDownloadImage && (
                    <button
                        type="button"
                        className="whiteboard-context-menu-item"
                        onClick={() => {
                            onDownloadImage?.();
                            onClose?.();
                        }}
                    >
                        <Download size={16} />
                        <span>Baixar imagem</span>
                    </button>
                )}
                <button
                    type="button"
                    className="whiteboard-context-menu-item"
                    onClick={() => {
                        onBringToFront?.();
                        onClose?.();
                    }}
                >
                    <BringToFront size={16} />
                    <span>Trazer para frente</span>
                </button>
                <button
                    type="button"
                    className="whiteboard-context-menu-item"
                    onClick={() => {
                        onSendToBack?.();
                        onClose?.();
                    }}
                >
                    <SendToBack size={16} />
                    <span>Enviar para trás</span>
                </button>
                {showColorPicker && (
                    <>
                        <div className="whiteboard-context-menu-sep" />
                        <div className="whiteboard-context-menu-colors">
                            {COLOR_OPTIONS.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    className="whiteboard-context-menu-swatch"
                                    style={{ background: c }}
                                    title={c}
                                    onClick={() => {
                                        onColorChange?.(c);
                                        onClose?.();
                                    }}
                                />
                            ))}
                        </div>
                    </>
                )}
                <div className="whiteboard-context-menu-sep" />
                <button
                    type="button"
                    className="whiteboard-context-menu-item"
                    onClick={() => {
                        onDuplicate?.();
                        onClose?.();
                    }}
                >
                    <Copy size={16} />
                    <span>Duplicar</span>
                </button>
                <button
                    type="button"
                    className="whiteboard-context-menu-item whiteboard-context-menu-item--danger"
                    onClick={() => {
                        onDelete?.();
                        onClose?.();
                    }}
                >
                    <Trash2 size={16} />
                    <span>Excluir</span>
                </button>
            </div>
        );
    }

    return (
        <div
            className="whiteboard-context-menu"
            style={{ position: 'fixed', left, top, zIndex: 10001 }}
            onContextMenu={(e) => e.preventDefault()}
        >
            <div className="whiteboard-context-menu-title">Criar</div>
            {CREATE_ITEMS.map(({ type, label, icon: Icon }) => (
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
            <button type="button" className="whiteboard-context-menu-item" onClick={() => { onUploadImage?.(); onClose?.(); }}>
                <ImagePlus size={16} />
                <span>Imagem</span>
            </button>
            <button type="button" className="whiteboard-context-menu-item" onClick={() => { onUploadFile?.(); onClose?.(); }}>
                <FileUp size={16} />
                <span>Arquivo</span>
            </button>
        </div>
    );
}
