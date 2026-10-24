
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


