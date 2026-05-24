import React, { useState, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import ToolbarToolMenu from './ToolbarToolMenu.jsx';
import { setToolDragData } from './ToolbarToolButton.jsx';
import { TOOL_VARIANT_MIME } from './toolMenuRegistry.js';

export default function ToolbarToolGroup({
    tool,
    config,
    activeTool,
    activeVariant,
    onSelectTool,
    onSelectVariant,
}) {
    const groupRef = useRef(null);
    const chevronRef = useRef(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const isActive = activeTool === tool.id;
    const variant = activeVariant ?? config.defaultVariant;
    const ActiveIcon = config.getActiveIcon?.(variant, config.variants) ?? tool.icon;

    const handleMainClick = () => {
        setMenuOpen(false);
        onSelectTool(tool.id);
        onSelectVariant(tool.id, variant);
    };

    const handleVariantPick = (variantId) => {
        onSelectVariant(tool.id, variantId);
        onSelectTool(tool.id);
        setMenuOpen(false);
    };

    return (
        <div ref={groupRef} className={`left-toolbar-tool-group ${isActive ? 'active' : ''}`}>
            <button
                type="button"
                className="left-toolbar-btn left-toolbar-tool-group__main"
                onClick={handleMainClick}
                title={tool.label}
                draggable
                onDragStart={(e) => setToolDragData(e, tool.id, variant)}
            >
                <ActiveIcon size={20} />
            </button>
            <button
                ref={chevronRef}
                type="button"
                className="left-toolbar-btn left-toolbar-tool-group__chevron"
                onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen((v) => !v);
                }}
                title={`Mais opções — ${tool.label}`}
                aria-expanded={menuOpen}
            >
                <ChevronDown size={14} />
            </button>
            <ToolbarToolMenu
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                orientation="vertical"
                anchorRef={groupRef}
                triggerRef={chevronRef}
            >
                {config.variants.map((v) => {
                    const VIcon = v.icon;
                    return (
                        <button
                            key={v.id}
                            type="button"
                            role="menuitem"
                            className={variant === v.id ? 'active' : ''}
                            onClick={() => handleVariantPick(v.id)}
                            draggable
                            onDragStart={(e) => {
                                setToolDragData(e, tool.id, v.id);
                                setMenuOpen(false);
                            }}
                        >
                            <VIcon size={16} />
                            {v.label}
                        </button>
                    );
                })}
            </ToolbarToolMenu>
        </div>
    );
}

export { TOOL_VARIANT_MIME };
