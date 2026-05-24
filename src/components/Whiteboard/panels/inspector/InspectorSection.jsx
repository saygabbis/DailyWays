import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useWhiteboardSelectionStore } from '../../../../stores/whiteboardSelectionStore';

/** Cabeçalho de bloco reutilizável (estilo Figma), expansível/contraível. */
export default function InspectorSection({
    sectionId,
    title,
    children,
    actions = null,
    defaultExpanded = false,
    collapsible = true,
}) {
    const id = sectionId ?? title;
    const expanded = useWhiteboardSelectionStore((s) =>
        id in (s.inspectorSectionState ?? {})
            ? s.inspectorSectionState[id]
            : defaultExpanded
    );
    const setInspectorSectionExpanded = useWhiteboardSelectionStore(
        (s) => s.setInspectorSectionExpanded
    );

    const toggle = () => {
        setInspectorSectionExpanded(id, !expanded);
    };

    return (
        <div className={`space-inspector-section inspector-block ${expanded ? 'is-expanded' : 'is-collapsed'}`}>
            <div className="inspector-block-header">
                {collapsible ? (
                    <button
                        type="button"
                        className="inspector-block-toggle"
                        onClick={toggle}
                        aria-expanded={expanded}
                    >
                        <ChevronRight
                            size={14}
                            className={`inspector-block-chevron ${expanded ? 'is-expanded' : ''}`}
                            aria-hidden
                        />
                        <span className="space-inspector-section-title inspector-block-title">{title}</span>
                    </button>
                ) : (
                    <div className="space-inspector-section-title">{title}</div>
                )}
                {actions ? (
                    <div className="inspector-block-actions" onClick={(e) => e.stopPropagation()}>
                        {actions}
                    </div>
                ) : null}
            </div>
            {(!collapsible || expanded) && (
                <div className="inspector-block-body">{children}</div>
            )}
        </div>
    );
}
