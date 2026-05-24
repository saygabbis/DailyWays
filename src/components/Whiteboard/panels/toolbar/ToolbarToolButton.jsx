import React from 'react';
import { TOOL_VARIANT_MIME } from './toolMenuRegistry.js';

export default function ToolbarToolButton({
    tool,
    active,
    onClick,
    draggable = true,
}) {
    const { id, icon: Icon, label } = tool;

    return (
        <button
            type="button"
            className={`left-toolbar-btn ${active ? 'active' : ''}`}
            onClick={() => onClick(id)}
            title={label}
            draggable={draggable && id !== 'select'}
            onDragStart={(e) => {
                if (id === 'select') return;
                e.dataTransfer.setData('application/x-whiteboard-tool', id);
                e.dataTransfer.effectAllowed = 'copy';
            }}
        >
            <Icon size={20} />
        </button>
    );
}

export function setToolDragData(e, toolId, variantId = null) {
    e.dataTransfer.setData('application/x-whiteboard-tool', toolId);
    if (variantId) {
        e.dataTransfer.setData(TOOL_VARIANT_MIME, JSON.stringify({ toolId, variantId }));
    }
    e.dataTransfer.effectAllowed = 'copy';
}
